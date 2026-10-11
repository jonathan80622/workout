import { NextResponse } from 'next/server';
import { readWorkoutAppState, writeWorkoutAppState, StateConflictError } from '@/src/server/appStateStore';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const state = await readWorkoutAppState();
    return NextResponse.json(state, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('[app-state] read failed:', error);
    return NextResponse.json({ error: 'Could not read workout state from Postgres.' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: 'Body must be a JSON workout state.' }, { status: 400 });
  }

  try {
    const state = await writeWorkoutAppState(body);
    return NextResponse.json(state, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('[app-state] write failed:', error);
    if (error instanceof StateConflictError) return NextResponse.json({ error: error.message }, { status: 409 });
    if (error instanceof TypeError) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ error: 'Could not save workout state to Postgres.' }, { status: 500 });
  }
}
