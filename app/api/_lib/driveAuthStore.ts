import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';

const KEY_PREFIX = 'workout:drive-auth:';

type RedisResult<T> = {
  result?: T;
  error?: string;
};

function getRedisConfig() {
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  if (!url || !token) {
    throw new Error('Redis is not configured. Connect an Upstash Redis database to this Vercel project.');
  }
  return { url: url.replace(/\/$/, ''), token };
}

function getEncryptionSecret() {
  const secret = process.env.GOOGLE_DRIVE_TOKEN_ENCRYPTION_KEY || process.env.GOOGLE_DRIVE_CLIENT_SECRET;
  if (!secret) throw new Error('Google Drive token encryption is not configured.');
  return secret;
}

function encryptRefreshToken(refreshToken: string) {
  const key = createHash('sha256').update(getEncryptionSecret()).digest();
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(refreshToken, 'utf8'), cipher.final()]);
  return `v1.${iv.toString('base64url')}.${cipher.getAuthTag().toString('base64url')}.${ciphertext.toString('base64url')}`;
}

function decryptRefreshToken(value: string) {
  const [version, ivValue, tagValue, ciphertextValue] = value.split('.');
  if (version !== 'v1' || !ivValue || !tagValue || !ciphertextValue) {
    throw new Error('Stored Drive authorization is invalid.');
  }

  const key = createHash('sha256').update(getEncryptionSecret()).digest();
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(ivValue, 'base64url'));
  decipher.setAuthTag(Buffer.from(tagValue, 'base64url'));
  return Buffer.concat([
    decipher.update(Buffer.from(ciphertextValue, 'base64url')),
    decipher.final(),
  ]).toString('utf8');
}

async function redisCommand<T>(command: Array<string | number>): Promise<T | null> {
  const { url, token } = getRedisConfig();
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(command),
    cache: 'no-store',
  });

  const body = await response.json().catch(() => null) as RedisResult<T> | null;
  if (!response.ok || body?.error) {
    throw new Error(body?.error || 'Unable to access Drive authorization store.');
  }
  return body?.result ?? null;
}

function redisKey(dataFileId: string) {
  return `${KEY_PREFIX}${dataFileId}`;
}

export async function saveDriveRefreshToken(dataFileId: string, refreshToken: string) {
  const encrypted = encryptRefreshToken(refreshToken);
  const result = await redisCommand<string>(['SET', redisKey(dataFileId), encrypted]);
  if (result !== 'OK') throw new Error('Unable to persist Drive authorization.');
}

export async function hasDriveRefreshToken(dataFileId: string) {
  const result = await redisCommand<number>(['EXISTS', redisKey(dataFileId)]);
  return result === 1;
}

export async function getDriveRefreshToken(dataFileId: string) {
  const encrypted = await redisCommand<string>(['GET', redisKey(dataFileId)]);
  if (!encrypted) {
    throw new Error('No stored Drive authorization exists for this PT portal. Reconnect Google Drive as the owner.');
  }
  return decryptRefreshToken(encrypted);
}
