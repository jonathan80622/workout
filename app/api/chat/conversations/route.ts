import { NextResponse } from 'next/server';
import { requireOwner } from '@/src/server/auth';
import { chatErrorResponse } from '@/src/server/chat/http';
import { createConversation, listConversations } from '@/src/server/chat/store';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  try {
    const owner = await requireOwner(request);
    if (owner instanceof NextResponse) return owner;
    return NextResponse.json({ conversations: await listConversations(owner.ownerId) }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return chatErrorResponse(error, 'load your chats');
  }
}

export async function POST(request: Request) {
  try {
    const owner = await requireOwner(request);
    if (owner instanceof NextResponse) return owner;
    return NextResponse.json(await createConversation(owner.ownerId), { status: 201 });
  } catch (error) {
    return chatErrorResponse(error, 'start a chat');
  }
}
