import { NextResponse } from 'next/server';
import { SESSION_COOKIE } from '@/src/server/auth';

export const runtime = 'nodejs';

// Ends this browser's session only; the stored Drive grant stays so the next sign-in needs no consent.
export async function POST() {
  const response = new NextResponse(null, { status: 204 });
  response.cookies.delete({ name: SESSION_COOKIE, path: '/' });
  return response;
}
