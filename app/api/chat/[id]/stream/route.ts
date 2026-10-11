import { NextResponse } from 'next/server';
import { UI_MESSAGE_STREAM_HEADERS } from 'ai';
import { requireOwner } from '@/src/server/auth';
import { chatErrorResponse } from '@/src/server/chat/http';
import { getStreamContext } from '@/src/server/chat/redis';
import { loadChat } from '@/src/server/chat/store';

export const runtime = 'nodejs';
export const maxDuration = 60;

// useChat({ resume: true }) calls this on mount to rejoin a reply that is still generating, on any instance.
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const owner = await requireOwner(request);
    if (owner instanceof NextResponse) return owner;
    const chat = await loadChat(owner.ownerId, (await params).id);
    const context = getStreamContext();
    if (!chat.activeStreamId || !context) return new Response(null, { status: 204 });

    const stream = await context.resumeExistingStream(chat.activeStreamId);
    if (!stream) return new Response(null, { status: 204 });
    return new Response(stream.pipeThrough(new TextEncoderStream()), { headers: UI_MESSAGE_STREAM_HEADERS });
  } catch (error) {
    return chatErrorResponse(error, 'resume the reply');
  }
}
