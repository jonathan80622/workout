import { AuthConfigError } from '@/src/server/auth';

export const OAUTH_STATE_COOKIE = 'workout_oauth';
export const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';
const AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';

type TokenResponse = {
  access_token?: string;
  expires_in?: number;
  refresh_token?: string;
  id_token?: string;
  scope?: string;
  error?: string;
  error_description?: string;
};

export class GoogleGrantRevokedError extends Error {}

function clientCredentials() {
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new AuthConfigError('Google OAuth client is not configured.');
  return { clientId, clientSecret };
}

// The browser-facing origin. request.url can carry the bind address (e.g. 0.0.0.0 from `next dev -H 0.0.0.0`),
// which Google would reject as a redirect URI.
export function appUrl(request: Request, path: string): URL {
  const url = new URL(request.url);
  const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host') ?? url.host;
  const protocol = request.headers.get('x-forwarded-proto') ?? url.protocol.replace(':', '');
  return new URL(path, `${protocol}://${host}`);
}

export function callbackUrl(request: Request): string {
  return appUrl(request, '/api/auth/google/callback').toString();
}

export function buildAuthorizationUrl(params: {
  redirectUri: string;
  state: string;
  codeChallenge: string;
  forceConsent: boolean;
}): string {
  const url = new URL(AUTH_ENDPOINT);
  url.search = new URLSearchParams({
    client_id: clientCredentials().clientId,
    redirect_uri: params.redirectUri,
    response_type: 'code',
    scope: `openid email ${DRIVE_SCOPE}`,
    access_type: 'offline',
    state: params.state,
    code_challenge: params.codeChallenge,
    code_challenge_method: 'S256',
    // Google issues a refresh token only on consent, so consent is forced only when none is stored.
    ...(params.forceConsent ? { prompt: 'consent' } : {}),
  }).toString();
  return url.toString();
}

export async function exchangeCode(params: { code: string; redirectUri: string; codeVerifier: string }) {
  const { clientId, clientSecret } = clientCredentials();
  const tokens = await postToken({
    grant_type: 'authorization_code',
    code: params.code,
    redirect_uri: params.redirectUri,
    code_verifier: params.codeVerifier,
    client_id: clientId,
    client_secret: clientSecret,
  });
  if (!tokens.id_token) throw new Error('Google did not return an ID token.');

  // The ID token came straight from Google's token endpoint over TLS, so per OIDC Core 3.1.3.7
  // its signature need not be checked; issuer, audience and expiry still are.
  const claims = JSON.parse(Buffer.from(tokens.id_token.split('.')[1], 'base64url').toString('utf8'));
  if (!['https://accounts.google.com', 'accounts.google.com'].includes(claims.iss)) throw new Error('Unexpected ID token issuer.');
  if (claims.aud !== clientId) throw new Error('ID token was issued to a different client.');
  if (typeof claims.exp !== 'number' || claims.exp * 1000 <= Date.now()) throw new Error('ID token has expired.');
  if (typeof claims.sub !== 'string' || !claims.sub) throw new Error('ID token has no subject.');

  return {
    googleSub: claims.sub as string,
    email: typeof claims.email === 'string' ? claims.email : null,
    refreshToken: tokens.refresh_token ?? null,
    grantedDrive: (tokens.scope ?? '').split(' ').includes(DRIVE_SCOPE),
  };
}

export async function refreshAccessToken(refreshToken: string): Promise<{ accessToken: string; expiresIn: number }> {
  const { clientId, clientSecret } = clientCredentials();
  const tokens = await postToken({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    client_id: clientId,
    client_secret: clientSecret,
  });
  if (!tokens.access_token) throw new Error('Google did not return an access token.');
  return { accessToken: tokens.access_token, expiresIn: tokens.expires_in ?? 3600 };
}

async function postToken(body: Record<string, string>): Promise<TokenResponse> {
  const response = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(body),
  });
  const data = (await response.json().catch(() => ({}))) as TokenResponse;
  if (response.ok) return data;
  // invalid_grant: the user revoked access, or Google expired the refresh token.
  if (data.error === 'invalid_grant') throw new GoogleGrantRevokedError(data.error_description || 'Google access was revoked.');
  throw new Error(`Google token request failed: ${data.error || response.status}`);
}
