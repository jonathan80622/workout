import { NextResponse } from 'next/server';
import { readSessionUserId } from '@/src/server/auth';
import { prisma } from '@/src/server/db';

export type ObservabilityAdmin = {
  ownerId: string;
  authSubject: string;
};

export class ObservabilityForbiddenError extends Error {
  status = 403;
}

function configuredAdminSubjects(): Set<string> {
  return new Set((process.env.OBSERVABILITY_ADMIN_GOOGLE_SUBS || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean));
}

export async function requireObservabilityAdmin(request: Request): Promise<ObservabilityAdmin | NextResponse> {
  const userId = await readSessionUserId(request);
  if (!userId) return NextResponse.json({ error: 'Sign in to continue.' }, { status: 401 });

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { authSubject: true } });
  const admins = configuredAdminSubjects();
  if (!user?.authSubject || !admins.has(user.authSubject)) {
    return NextResponse.json({ error: 'Observability access is restricted.' }, { status: 403 });
  }

  return { ownerId: userId, authSubject: user.authSubject };
}

export async function requireObservabilityAdminOrThrow(request: Request): Promise<ObservabilityAdmin> {
  const result = await requireObservabilityAdmin(request);
  if (result instanceof NextResponse) {
    const error = new ObservabilityForbiddenError(result.status === 401 ? 'Sign in to continue.' : 'Observability access is restricted.');
    error.status = result.status;
    throw error;
  }
  return result;
}
