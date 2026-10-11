const TOKENINFO_ENDPOINT = 'https://oauth2.googleapis.com/tokeninfo';
const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';

export class InvalidGoogleTokenError extends Error {}

/**
 * Identifies the Google account behind a browser-issued access token.
 * The audience check is what stops a token issued to some other app from signing in here.
 */
export async function verifyGoogleAccessToken(accessToken: string): Promise<{ googleSub: string; grantedDrive: boolean }> {
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  if (!clientId) throw new Error('NEXT_PUBLIC_GOOGLE_CLIENT_ID is not configured.');

  const response = await fetch(TOKENINFO_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ access_token: accessToken }),
  });
  if (response.status === 400) throw new InvalidGoogleTokenError('Google rejected the access token.');
  if (!response.ok) throw new Error(`Google token check failed: ${response.status}`);

  const info = await response.json();
  if (info.aud !== clientId) throw new InvalidGoogleTokenError('Access token was issued to a different client.');
  if (typeof info.sub !== 'string' || !info.sub) throw new InvalidGoogleTokenError('Access token has no Google account ID.');
  return {
    googleSub: info.sub,
    // Google's consent screen lets the user untick Drive; signing in means Drive was granted.
    grantedDrive: typeof info.scope === 'string' && info.scope.split(' ').includes(DRIVE_SCOPE),
  };
}
