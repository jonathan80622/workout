import { NextResponse } from 'next/server';
import { requireOwner } from '@/src/server/auth';
import { chatErrorResponse } from '@/src/server/chat/http';
import { requestStop } from '@/src/server/chat/redis';
import { loadChat } from '@/src/server/chat/store';

export const runtime = 'nodejs';

// Closing the browser's stream does not stop generation (it keeps running so the reply can be resumed),
// so Stop is an explicit request, relayed through Redis to whichever instance is generating.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const owner = await requireOwner(request);
    if (owner instanceof NextResponse) return owner;
    const chat = await loadChat(owner.ownerId, (await params).id);
    await requestStop(chat.id);
    return NextResponse.json({ stopped: true });
  } catch (error) {
    return chatErrorResponse(error, 'stop the reply');
  }
}
