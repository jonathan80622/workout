import { NextResponse } from 'next/server';
import { findClientUserId, readWorkoutAppState } from '@/src/server/appStateStore';
import { prisma } from '@/src/server/db';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const configuredPassword = process.env.PT_VIEW_PASSWORD;

  if (!configuredPassword) {
    return NextResponse.json({ error: 'PT_VIEW_PASSWORD is not configured.' }, { status: 500 });
  }

  const body = await request.json().catch(() => null);
  const password = body?.password;

  if (password !== configuredPassword) {
    return NextResponse.json({ error: 'Incorrect password.' }, { status: 401 });
  }

  try {
    const clientId = await findClientUserId();
    const state = await readWorkoutAppState(clientId ? { id: clientId } : null);
      return NextResponse.json(state, {
        headers: {
          'Cache-Control': 'no-store',
        },
      });
  } catch (error) {
    console.error('[pt-state] Postgres read failed:', error);
    return NextResponse.json({ error: 'Could not load workouts. Try again.' }, { status: 503 });
  }
}

export async function PATCH(request: Request) {
  const password = process.env.PT_VIEW_PASSWORD;
  const body = await request.json().catch(() => null);
  if (!password || body?.password !== password) return NextResponse.json({ error: 'Incorrect password.' }, { status: 401 });
  if (typeof body.workoutId !== 'string' || typeof body.text !== 'string' || (body.exerciseId != null && typeof body.exerciseId !== 'string')) {
    return NextResponse.json({ error: 'Invalid comment.' }, { status: 400 });
  }
  try {
    await prisma.$transaction(async (db) => {
      const clientId = await findClientUserId(db);
      if (!clientId) throw new Error('No client user exists.');
      const owner = await db.user.update({ where: { id: clientId }, data: { stateRevision: { increment: 1 } } });
      const workout = await db.workout.findUniqueOrThrow({ where: { ownerId_legacyId: { ownerId: owner.id, legacyId: body.workoutId } } });
      if (body.exerciseId) {
        await db.exerciseLog.update({ where: { workoutId_legacyId: { workoutId: workout.id, legacyId: body.exerciseId } }, data: { ptComment: body.text } });
      } else {
        await db.workout.update({ where: { id: workout.id }, data: { ptComment: body.text } });
      }
    });
    return NextResponse.json({ saved: true });
  } catch (error) {
    console.error('[pt-state] comment save failed:', error);
    return NextResponse.json({ error: 'Comment not saved. Try again.' }, { status: 503 });
  }
}
