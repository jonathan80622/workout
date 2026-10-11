import { after } from 'next/server';
import { createClient } from 'redis';
import { createResumableStreamContext, type ResumableStreamContext } from 'resumable-stream';

// Redis carries what must cross serverless instances: the replayable reply stream (resumable-stream)
// and stop requests, which may land on a different instance than the one generating the reply.
// Without REDIS_URL (local dev), replies cannot be resumed and stop only reaches this instance.
const redisUrl = () => process.env.REDIS_URL || process.env.KV_URL || '';
let streamContext: ResumableStreamContext | null = null;
let publisher: ReturnType<typeof connect> | null = null;
let subscriber: ReturnType<typeof connect> | null = null;
const localStops = new Map<string, () => void>();

export function getStreamContext(): ResumableStreamContext | null {
  if (!redisUrl()) return null;
  streamContext ||= createResumableStreamContext({ waitUntil: after, keyPrefix: 'workout-chat' });
  return streamContext;
}

function connect() {
  const client = createClient({ url: redisUrl() });
  client.on('error', (error) => console.error('[chat] redis error:', error));
  return client.connect();
}

function resetOnFailure<T>(promise: Promise<T>, reset: () => void) {
  promise.catch(reset);
  return promise;
}

const stopChannel = (chatId: string) => `workout-chat:stop:${chatId}`;

/** Calls `abort` when a stop is requested for this chat from any instance. Returns the unsubscribe. */
export async function listenForStop(chatId: string, abort: () => void): Promise<() => Promise<void>> {
  localStops.set(chatId, abort);
  let unsubscribe = async () => {};
  if (redisUrl()) {
    try {
      subscriber ||= resetOnFailure(connect(), () => { subscriber = null; });
      const client = await subscriber;
      await client.subscribe(stopChannel(chatId), abort);
      unsubscribe = async () => { await client.unsubscribe(stopChannel(chatId), abort); };
    } catch (error) {
      console.error('[chat] stop subscription failed; stop will only reach this instance:', error);
    }
  }
  return async () => {
    if (localStops.get(chatId) === abort) localStops.delete(chatId);
    await unsubscribe().catch((error) => console.error('[chat] stop unsubscribe failed:', error));
  };
}

export async function requestStop(chatId: string): Promise<void> {
  localStops.get(chatId)?.();
  if (!redisUrl()) return;
  publisher ||= resetOnFailure(connect(), () => { publisher = null; });
  await (await publisher).publish(stopChannel(chatId), 'stop');
}
