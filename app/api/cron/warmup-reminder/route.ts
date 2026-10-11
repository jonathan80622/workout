import { NextResponse } from 'next/server';
import { runWarmupReminder } from '@/src/server/warmupReminder';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Vercel Cron calls this with `Authorization: Bearer $CRON_SECRET`.
export async function GET(request: Request) {
  const { status, body } = await runWarmupReminder(request.headers.get('authorization'));
  return NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
}
