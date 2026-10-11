import { NextResponse } from 'next/server';
import { deleteSession, SESSION_COOKIE } from '@/src/server/auth';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  await deleteSession(request).catch((error) => console.error('[auth] sign-out failed:', error));
  const response = new NextResponse(null, { status: 204 });
  response.cookies.delete({ name: SESSION_COOKIE, path: '/' });
  return response;
}
