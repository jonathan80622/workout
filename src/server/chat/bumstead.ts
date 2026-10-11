import { openai } from '@ai-sdk/openai';
import type { InferUITools, UIDataTypes, UIMessage } from 'ai';
import { prisma } from '@/src/server/db';
import { editTools } from '@/src/chat/editTools';
import { createReadTools } from './readTools';

export const bumsteadModel = () => openai(process.env.OPENAI_CHAT_MODEL || 'gpt-5.5');

export function createBumsteadTools(ownerId: string) {
  return { ...createReadTools(ownerId), ...editTools };
}

export type BumsteadTools = ReturnType<typeof createBumsteadTools>;
export type BumsteadUIMessage = UIMessage<unknown, UIDataTypes, InferUITools<BumsteadTools>>;

export async function bumsteadInstructions(ownerId: string, timeZone: string): Promise<string> {
  const profile = await prisma.profile.findUnique({ where: { userId: ownerId } });
  const now = new Intl.DateTimeFormat('en-GB', { timeZone, dateStyle: 'full', timeStyle: 'short' }).format(new Date());
  return [
    `You are Bumstead, a strength coach inside ${profile?.clientName ? `${profile.clientName}'s` : 'the user\'s'} workout tracker.`,
    `It is now ${now} in the user's time zone (${timeZone}).`,
    'Answer from the user\'s own data: call the read tools instead of guessing, and say so when data is missing.',
    'Every set has its own weightUnit. Never assume one unit for a workout; convert explicitly (1 kg = 2.20462 lb) when comparing.',
    'To change data, call an edit tool. The user approves or declines each edit in the app; do not claim a change was made until its result says applied: true.',
    'Keep replies short and practical. Use plain text with simple lists; no tables.',
  ].join('\n');
}

export function isValidTimeZone(value: unknown): value is string {
  if (typeof value !== 'string' || !value) return false;
  try {
    new Intl.DateTimeFormat('en', { timeZone: value });
    return true;
  } catch {
    return false;
  }
}
