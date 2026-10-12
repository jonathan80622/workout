import { NextResponse } from 'next/server';
import { readSessionUserId } from '@/src/server/auth';

export type ObservabilityViewer = {
  ownerId: string;
};

export async function requireObservabilityViewer(request: Request): Promise<ObservabilityViewer | NextResponse> {
  const userId = await readSessionUserId(request);
  if (!userId) return NextResponse.json({ error: 'Sign in to continue.' }, { status: 401 });
  return { ownerId: userId };
}

export async function requireObservabilityViewerOrThrow(request: Request): Promise<ObservabilityViewer> {
  const result = await requireObservabilityViewer(request);
  if (result instanceof NextResponse) {
    const error = new Error('Sign in to continue.') as Error & { status: number };
    error.status = 401;
    throw error;
  }
  return result;
}
