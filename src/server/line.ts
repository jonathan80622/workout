import { randomUUID } from 'node:crypto';

const TOKEN_URL = 'https://api.line.me/oauth2/v3/token';
const BROADCAST_URL = 'https://api.line.me/v2/bot/message/broadcast';
const TIMEOUT_MS = 10_000;
const MAX_TEXT_LENGTH = 5000;

// Messages never include the channel secret or access token.
export class LineError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
  }
}

type Env = Record<string, string | undefined>;
type Fetch = typeof fetch;

export function readLineConfig(env: Env = process.env) {
  const channelId = env.LINE_CHANNEL_ID?.trim();
  const channelSecret = env.LINE_CHANNEL_SECRET?.trim();
  const missing = [!channelId && 'LINE_CHANNEL_ID', !channelSecret && 'LINE_CHANNEL_SECRET'].filter(Boolean);
  if (missing.length > 0) throw new LineError(`Missing ${missing.join(', ')}.`);
  return { channelId: channelId!, channelSecret: channelSecret! };
}

/** Sends one text message to every friend of the Official Account. Success means LINE accepted it, not that it was read. */
export async function broadcastLineText(text: string, { env = process.env, fetchImpl = fetch }: { env?: Env; fetchImpl?: Fetch } = {}) {
  const config = readLineConfig(env);
  const accessToken = await issueStatelessToken(config.channelId, config.channelSecret, fetchImpl);

  const response = await request(fetchImpl, 'broadcast', BROADCAST_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'X-Line-Retry-Key': randomUUID(),
    },
    body: JSON.stringify({ messages: [{ type: 'text', text: text.slice(0, MAX_TEXT_LENGTH) }] }),
  });
  if (!response.ok) throw new LineError(`LINE broadcast failed: ${await describeError(response)}`, response.status);
  return { requestId: response.headers.get('x-line-request-id') };
}

// A stateless channel access token lasts 15 minutes and is never stored.
async function issueStatelessToken(channelId: string, channelSecret: string, fetchImpl: Fetch) {
  const response = await request(fetchImpl, 'token', TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'client_credentials', client_id: channelId, client_secret: channelSecret }),
  });
  if (!response.ok) throw new LineError(`LINE token request failed: ${await describeError(response)}`, response.status);

  const body = await response.json().catch(() => null);
  if (typeof body?.access_token !== 'string' || !body.access_token) {
    throw new LineError('LINE token response had no access_token.', response.status);
  }
  return body.access_token as string;
}

async function request(fetchImpl: Fetch, label: string, url: string, init: RequestInit) {
  try {
    return await fetchImpl(url, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS) });
  } catch (error) {
    const reason = error instanceof Error && error.name === 'TimeoutError' ? 'timed out' : 'could not connect';
    throw new LineError(`LINE ${label} request ${reason}.`);
  }
}

// LINE error bodies carry a human-readable `message`; they do not echo credentials.
async function describeError(response: Response) {
  const body = await response.json().catch(() => null);
  const message = typeof body?.message === 'string' ? body.message.slice(0, 200) : 'no error message';
  return `HTTP ${response.status} (${message})`;
}
