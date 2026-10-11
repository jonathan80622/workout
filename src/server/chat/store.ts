import type { UIMessage } from 'ai';
import { Prisma } from '@prisma/client';
import { prisma } from '@/src/server/db';

export class ChatNotFoundError extends Error {}

export type ChatSummary = { id: string; title: string; updatedAt: string };
export type StoredChat = { id: string; title: string; activeStreamId: string | null; messages: UIMessage[] };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DEFAULT_TITLE = 'New chat';

export async function listConversations(ownerId: string): Promise<ChatSummary[]> {
  const conversations = await prisma.chatConversation.findMany({
    where: { ownerId },
    orderBy: { updatedAt: 'desc' },
    select: { id: true, title: true, updatedAt: true },
  });
  return conversations.map((conversation) => ({
    id: conversation.id,
    title: conversation.title || DEFAULT_TITLE,
    updatedAt: conversation.updatedAt.toISOString(),
  }));
}

export async function createConversation(ownerId: string): Promise<ChatSummary> {
  const conversation = await prisma.chatConversation.create({ data: { ownerId } });
  return { id: conversation.id, title: DEFAULT_TITLE, updatedAt: conversation.updatedAt.toISOString() };
}

/** The owner's conversation; another owner's chat is reported as missing rather than forbidden. */
export async function loadChat(ownerId: string, id: string): Promise<StoredChat> {
  if (!UUID.test(id)) throw new ChatNotFoundError('Chat not found.');
  const conversation = await prisma.chatConversation.findFirst({
    where: { id, ownerId },
    include: { messages: { orderBy: [{ position: 'asc' }, { createdAt: 'asc' }] } },
  });
  if (!conversation) throw new ChatNotFoundError('Chat not found.');
  return {
    id: conversation.id,
    title: conversation.title || DEFAULT_TITLE,
    activeStreamId: conversation.activeStreamId,
    messages: conversation.messages.map((message) => ({
      id: message.uiMessageId,
      role: message.role as UIMessage['role'],
      parts: message.parts as UIMessage['parts'],
      ...(message.metadata == null ? {} : { metadata: message.metadata }),
    })),
  };
}

export async function deleteConversation(ownerId: string, id: string): Promise<void> {
  if (!UUID.test(id)) throw new ChatNotFoundError('Chat not found.');
  const deleted = await prisma.chatConversation.deleteMany({ where: { id, ownerId } });
  if (!deleted.count) throw new ChatNotFoundError('Chat not found.');
}

/** Makes the stored thread exactly `messages`: upserts each by its UIMessage id and drops the rest (e.g. a regenerated reply). */
export async function saveMessages(conversationId: string, thread: UIMessage[]): Promise<void> {
  // A reply that failed before producing anything has no parts; storing it would only confuse the next turn.
  const messages = thread.filter((message) => message.role !== 'assistant' || message.parts.length > 0);
  const firstUserText = messages.find((message) => message.role === 'user');
  await prisma.$transaction(async (db) => {
    await db.chatMessage.deleteMany({
      where: { conversationId, uiMessageId: { notIn: messages.map((message) => message.id) } },
    });
    for (const [position, message] of messages.entries()) {
      const data = {
        position,
        role: message.role,
        content: messageText(message),
        parts: message.parts as Prisma.InputJsonValue,
        metadata: message.metadata == null ? Prisma.DbNull : message.metadata as Prisma.InputJsonValue,
      };
      await db.chatMessage.upsert({
        where: { conversationId_uiMessageId: { conversationId, uiMessageId: message.id } },
        create: { conversationId, uiMessageId: message.id, ...data },
        update: data,
      });
    }
    const conversation = await db.chatConversation.findUniqueOrThrow({ where: { id: conversationId } });
    await db.chatConversation.update({
      where: { id: conversationId },
      // Touch updatedAt so the thread list shows the latest chat first; name it after its first question.
      data: { title: conversation.title || (firstUserText ? titleFrom(messageText(firstUserText)) : null) },
    });
  });
}

export async function setActiveStream(conversationId: string, streamId: string | null): Promise<void> {
  await prisma.chatConversation.update({ where: { id: conversationId }, data: { activeStreamId: streamId } });
}

/** Clears the active stream only if it is still `streamId`, so a finished old reply cannot clear a newer one. */
export async function clearActiveStream(conversationId: string, streamId: string): Promise<void> {
  await prisma.chatConversation.updateMany({ where: { id: conversationId, activeStreamId: streamId }, data: { activeStreamId: null } });
}

function messageText(message: UIMessage): string {
  return message.parts.flatMap((part) => (part.type === 'text' ? [part.text] : [])).join('\n').trim();
}

function titleFrom(text: string): string | null {
  const line = text.split('\n')[0].trim();
  if (!line) return null;
  return line.length > 60 ? `${line.slice(0, 57)}...` : line;
}
