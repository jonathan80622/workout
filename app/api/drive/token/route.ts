import { NextResponse } from 'next/server';
import { prisma } from '@/src/server/db';
import { decryptSecret, readSessionAccountId } from '@/src/server/auth';
import { GoogleGrantRevokedError, refreshAccessToken } from '@/src/server/google';

export const runtime = 'nodejs';

// Mints a short-lived Drive access token from the signed-in account's stored refresh token.
export async function GET(request: Request) {
  try {
    const accountId = readSessionAccountId(request);
    if (!accountId) return NextResponse.json({ error: 'Sign in to continue.' }, { status: 401 });

    const account = await prisma.account.findUnique({ where: { id: accountId }, select: { encryptedRefreshToken: true } });
    if (!account) return NextResponse.json({ error: 'Sign in to continue.' }, { status: 401 });
    if (!account.encryptedRefreshToken) return NextResponse.json({ error: 'Drive is not connected.' }, { status: 409 });

    try {
      const token = await refreshAccessToken(decryptSecret(account.encryptedRefreshToken));
      return NextResponse.json(token, { headers: { 'Cache-Control': 'no-store' } });
    } catch (error) {
      if (!(error instanceof GoogleGrantRevokedError)) throw error;
      await prisma.account.update({ where: { id: accountId }, data: { encryptedRefreshToken: null } });
      return NextResponse.json({ error: 'Google access expired. Connect Drive again.' }, { status: 409 });
    }
  } catch (error) {
    console.error('[drive-token] failed:', error);
    return NextResponse.json({ error: 'Could not reach Google Drive. Try again.' }, { status: 503 });
  }
}
