import { NextResponse } from 'next/server';
import { requireOwner } from '@/src/server/auth';
import { chatErrorResponse } from '@/src/server/chat/http';
import { deleteConversation, loadChat } from '@/src/server/chat/store';

export const runtime = 'nodejs';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const owner = await requireOwner(request);
    if (owner instanceof NextResponse) return owner;
    const chat = await loadChat(owner.ownerId, (await params).id);
    return NextResponse.json({ id: chat.id, title: chat.title, messages: chat.messages }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return chatErrorResponse(error, 'load the chat');
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const owner = await requireOwner(request);
    if (owner instanceof NextResponse) return owner;
    await deleteConversation(owner.ownerId, (await params).id);
    return NextResponse.json({ deleted: true });
  } catch (error) {
    return chatErrorResponse(error, 'delete the chat');
  }
}
