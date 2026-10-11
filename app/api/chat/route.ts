import { after, NextResponse } from 'next/server';
import { convertToModelMessages, createIdGenerator, generateId, safeValidateUIMessages, stepCountIs, streamText } from 'ai';
import { requireOwner } from '@/src/server/auth';
import { bumsteadInstructions, bumsteadModel, createBumsteadTools, isValidTimeZone, type BumsteadUIMessage } from '@/src/server/chat/bumstead';
import { chatErrorResponse } from '@/src/server/chat/http';
import { getStreamContext, listenForStop } from '@/src/server/chat/redis';
import { clearActiveStream, loadChat, saveMessages, setActiveStream } from '@/src/server/chat/store';

export const runtime = 'nodejs';
export const maxDuration = 60;

// The client sends only its newest message; the full thread is loaded from Postgres, so any instance can serve any turn.
export async function POST(request: Request) {
  const owner = await requireOwner(request).catch((error) => chatErrorResponse(error, 'check sign-in'));
  if (owner instanceof NextResponse) return owner;

  const body = await request.json().catch(() => null);
  const trigger = body?.trigger ?? 'submit-message';
  if (typeof body?.id !== 'string' || !['submit-message', 'regenerate-message'].includes(trigger)
    || (trigger === 'submit-message' && (!body.message || typeof body.message !== 'object'))) {
    return NextResponse.json({ error: 'Body must be { id, message }.' }, { status: 400 });
  }
  const timeZone = isValidTimeZone(body.timeZone) ? body.timeZone : 'UTC';

  let chat;
  try {
    chat = await loadChat(owner.ownerId, body.id);
  } catch (error) {
    return chatErrorResponse(error, 'load the chat');
  }

  const tools = createBumsteadTools(owner.ownerId);
  let thread = chat.messages;
  if (trigger === 'regenerate-message') {
    // Drop the reply being regenerated: everything after the last user message.
    let lastUser = thread.length - 1;
    while (lastUser >= 0 && thread[lastUser].role !== 'user') lastUser -= 1;
    thread = thread.slice(0, lastUser + 1);
  } else {
    // A message the thread already has (an approved or declined edit) replaces the stored copy.
    const index = thread.findIndex((message) => message.id === body.message.id);
    thread = index === -1 ? [...thread, body.message] : thread.map((message, i) => (i === index ? body.message : message));
  }
  const validated = await safeValidateUIMessages<BumsteadUIMessage>({ messages: thread, tools });
  if (!validated.success) {
    return NextResponse.json({ error: 'Invalid chat message.' }, { status: 400 });
  }
  const messages = validated.data;

  const streamId = generateId();
  const stop = new AbortController();
  let stopListening: () => Promise<void>;
  try {
    await saveMessages(chat.id, messages);
    await setActiveStream(chat.id, null);
    stopListening = await listenForStop(chat.id, () => stop.abort());
  } catch (error) {
    return chatErrorResponse(error, 'save the chat');
  }

  const result = streamText({
    model: bumsteadModel(),
    instructions: await bumsteadInstructions(owner.ownerId, timeZone),
    messages: await convertToModelMessages(messages, { tools }),
    tools,
    stopWhen: stepCountIs(8),
    abortSignal: stop.signal,
  });
  // Keep generating after the browser disconnects, so the saved reply is complete.
  after(Promise.resolve(result.consumeStream()));

  return result.toUIMessageStreamResponse<BumsteadUIMessage>({
    originalMessages: messages,
    generateMessageId: createIdGenerator({ prefix: 'msg', size: 16 }),
    onError: (error) => {
      console.error('[chat] generation failed:', error);
      return 'Bumstead could not finish this reply. Try again.';
    },
    onEnd: async ({ messages: finished }) => {
      try {
        await saveMessages(chat.id, finished);
      } catch (error) {
        console.error('[chat] saving the reply failed:', error);
      } finally {
        await clearActiveStream(chat.id, streamId).catch((error) => console.error('[chat] clearing the active stream failed:', error));
        await stopListening();
      }
    },
    consumeSseStream: async ({ stream }) => {
      const context = getStreamContext();
      if (!context) return;
      try {
        await setActiveStream(chat.id, streamId);
        await context.createNewResumableStream(streamId, () => stream);
      } catch (error) {
        console.error('[chat] could not make the reply resumable:', error);
      }
    },
  });
}
