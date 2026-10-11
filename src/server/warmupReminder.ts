import { createHash, timingSafeEqual } from 'node:crypto';
import { prisma } from '@/src/server/db';
import { LineError, broadcastLineText } from '@/src/server/line';

export const REMINDER_TIME_ZONE = 'America/New_York';

type Env = Record<string, string | undefined>;
export type ReminderMove = { name: string; target: string };
export type ReminderResult = { status: number; body: Record<string, unknown> };

/** Calendar date and hour in New York, whatever the server's own time zone. */
export function newYorkTime(now: Date) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: REMINDER_TIME_ZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(now).map((part) => [part.type, part.value])
  );
  return { date: `${parts.year}-${parts.month}-${parts.day}`, hour: Number(parts.hour) };
}

export function formatWarmupReminder(moves: ReminderMove[]) {
  return ['Morning warmup ☀️', ...moves.map((move) => `・${move.name}${move.target ? ` — ${move.target}` : ''}`)].join('\n');
}

// There is one current plan. Read it directly: the app-state normalizer substitutes default moves for an empty list.
export async function loadWarmupMoves(): Promise<ReminderMove[] | null> {
  const plan = await prisma.trainingPlan.findFirst({
    where: { isCurrent: true },
    select: { warmupMoves: { orderBy: { position: 'asc' }, select: { name: true, targetText: true } } },
  });
  return plan && plan.warmupMoves.map((move) => ({ name: move.name, target: move.targetText }));
}

/** Handles one cron invocation (vercel.json schedules it once a day) by broadcasting to every friend of the Official Account. */
export async function runWarmupReminder(
  authorization: string | null,
  { now = new Date(), env = process.env, fetchImpl = fetch }: { now?: Date; env?: Env; fetchImpl?: typeof fetch } = {}
): Promise<ReminderResult> {
  const secret = env.CRON_SECRET;
  if (!secret) {
    console.error('[warmup-reminder] CRON_SECRET is not configured; refusing to run.');
    return { status: 500, body: { error: 'Not configured.' } };
  }
  if (!sameSecret(authorization, `Bearer ${secret}`)) return { status: 401, body: { error: 'Unauthorized.' } };

  const { date } = newYorkTime(now);
  let moves: ReminderMove[] | null;
  try {
    moves = await loadWarmupMoves();
  } catch (error) {
    console.error('[warmup-reminder] Postgres read failed:', error);
    return { status: 503, body: { sent: false, reason: 'database-error', date } };
  }
  if (!moves || moves.length === 0) {
    const reason = moves ? 'no-warmup-moves' : 'no-current-plan';
    console.warn(`[warmup-reminder] Skipped ${date}: ${reason}.`);
    return { status: 200, body: { sent: false, reason, date } };
  }

  try {
    const { requestId } = await broadcastLineText(formatWarmupReminder(moves), { env, fetchImpl });
    console.log(`[warmup-reminder] LINE accepted ${date} reminder (${moves.length} moves, request ${requestId ?? 'unknown'}).`);
    return { status: 200, body: { sent: true, date, moves: moves.length } };
  } catch (error) {
    if (!(error instanceof LineError)) throw error;
    console.error(`[warmup-reminder] ${date}: ${error.message}`);
    return { status: 502, body: { sent: false, reason: 'line-error', date } };
  }
}

function sameSecret(actual: string | null, expected: string) {
  const digest = (value: string) => createHash('sha256').update(value).digest();
  return actual !== null && timingSafeEqual(digest(actual), digest(expected));
}
