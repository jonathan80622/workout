import { NextResponse } from 'next/server';
import { ChatNotFoundError } from './store';

/** Maps a chat failure to a response, logging anything that is not the caller's fault. */
export function chatErrorResponse(error: unknown, action: string) {
  if (error instanceof ChatNotFoundError) return NextResponse.json({ error: error.message }, { status: 404 });
  console.error(`[chat] ${action} failed:`, error);
  return NextResponse.json({ error: `Could not ${action}. Try again.` }, { status: 500 });
}
