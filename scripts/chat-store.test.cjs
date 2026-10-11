const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const { createHash } = require('node:crypto');
const ts = require('typescript');

// Load the actual TypeScript modules with an isolated database double, as in app-state.test.cjs.
const root = path.resolve(__dirname, '..');
const cache = new Map();
let db;
function load(file) {
  file = path.resolve(root, file);
  if (!path.extname(file)) file += '.ts';
  if (cache.has(file)) return cache.get(file).exports;
  const module = { exports: {} };
  cache.set(file, module);
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  const localRequire = (name) => {
    if (name === '@/src/server/db') return { prisma: new Proxy({}, { get: (_, key) => key === '$transaction' ? async (fn) => fn(db) : db[key] }) };
    if (name.startsWith('@/')) return load(name.slice(2));
    if (name.startsWith('.')) return load(path.resolve(path.dirname(file), name));
    return Module.createRequire(file)(name);
  };
  new Function('require', 'module', 'exports', code)(localRequire, module, module.exports);
  return module.exports;
}
const { Prisma } = require('@prisma/client');
// Postgres stores Prisma.DbNull as SQL NULL, which reads back as null.
const stored = (data) => ({ ...data, metadata: data.metadata === Prisma.DbNull ? null : data.metadata });
const { loadChat, saveMessages, clearActiveStream, ChatNotFoundError } = load('src/server/chat/store.ts');

const CHAT = '11111111-2222-4333-8444-555555555555';
const session = { token: 'token-owner-1', userId: 'owner-1', expiresAt: new Date(Date.now() + 60_000) };
session.tokenHash = createHash('sha256').update(session.token).digest('base64url');
const signedIn = { cookie: `workout_session=${session.token}` };

// A chat table double: one conversation owned by owner-1, with messages kept in memory.
function fakeChatDatabase(messages = []) {
  const calls = [];
  const conversation = { id: CHAT, ownerId: 'owner-1', title: null, activeStreamId: null, updatedAt: new Date('2026-10-11T10:00:00Z') };
  const record = (model, operation, args) => calls.push({ model, operation, args });
  return {
    calls,
    conversation,
    messages,
    session: { findUnique: async ({ where }) => (where.tokenHash === session.tokenHash ? session : null) },
    chatConversation: {
      findFirst: async (args) => {
        record('chatConversation', 'findFirst', args);
        if (args.where.id !== CHAT || args.where.ownerId !== conversation.ownerId) return null;
        return { ...conversation, messages: [...messages].sort((a, b) => a.position - b.position) };
      },
      findUniqueOrThrow: async () => conversation,
      update: async (args) => { record('chatConversation', 'update', args); Object.assign(conversation, args.data); return conversation; },
      updateMany: async (args) => {
        record('chatConversation', 'updateMany', args);
        const matches = args.where.id === conversation.id && args.where.activeStreamId === conversation.activeStreamId;
        if (matches) Object.assign(conversation, args.data);
        return { count: matches ? 1 : 0 };
      },
    },
    chatMessage: {
      deleteMany: async (args) => {
        record('chatMessage', 'deleteMany', args);
        const keep = new Set(args.where.uiMessageId.notIn);
        messages.splice(0, messages.length, ...messages.filter((message) => keep.has(message.uiMessageId)));
      },
      upsert: async (args) => {
        record('chatMessage', 'upsert', args);
        const existing = messages.find((message) => message.uiMessageId === args.where.conversationId_uiMessageId.uiMessageId);
        if (existing) Object.assign(existing, stored(args.update));
        else messages.push({ ...stored(args.create), createdAt: new Date() });
      },
    },
  };
}

const userMessage = { id: 'msg-user', role: 'user', parts: [{ type: 'text', text: 'How has my leg press progressed?\nBe brief.' }] };
const assistantMessage = {
  id: 'msg-assistant',
  role: 'assistant',
  parts: [
    { type: 'step-start' },
    { type: 'tool-getExerciseHistory', toolCallId: 'call-1', state: 'output-available', input: { exerciseName: 'leg press' }, output: [] },
    { type: 'text', text: 'Up 10 kg in a month.', state: 'done' },
  ],
};

test('messages round-trip through Postgres as the same UIMessages', async () => {
  db = fakeChatDatabase();
  await saveMessages(CHAT, [userMessage, assistantMessage]);
  const chat = await loadChat('owner-1', CHAT);
  assert.deepEqual(chat.messages, [userMessage, assistantMessage]);
  assert.equal(db.messages[1].content, 'Up 10 kg in a month.');
  assert.equal(db.conversation.title, 'How has my leg press progressed?');
});

test('saving a shorter thread removes dropped replies and keeps order', async () => {
  db = fakeChatDatabase();
  await saveMessages(CHAT, [userMessage, assistantMessage]);
  await saveMessages(CHAT, [userMessage]);
  assert.deepEqual((await loadChat('owner-1', CHAT)).messages, [userMessage]);
});

test('a reply that failed before producing anything is not stored', async () => {
  db = fakeChatDatabase();
  await saveMessages(CHAT, [userMessage, { id: 'msg-failed', role: 'assistant', parts: [] }]);
  assert.deepEqual((await loadChat('owner-1', CHAT)).messages, [userMessage]);
});

test('another owner\'s chat and malformed ids are reported as not found', async () => {
  db = fakeChatDatabase();
  await assert.rejects(loadChat('owner-2', CHAT), ChatNotFoundError);
  const before = db.calls.length;
  await assert.rejects(loadChat('owner-1', 'not-a-uuid'), ChatNotFoundError);
  assert.equal(db.calls.length, before, 'a malformed id never reaches Postgres');
});

test('an old reply finishing does not clear a newer active stream', async () => {
  db = fakeChatDatabase();
  db.conversation.activeStreamId = 'stream-new';
  await clearActiveStream(CHAT, 'stream-old');
  assert.equal(db.conversation.activeStreamId, 'stream-new');
  await clearActiveStream(CHAT, 'stream-new');
  assert.equal(db.conversation.activeStreamId, null);
});

test('chat routes require sign-in and hide other owners\' chats', async () => {
  db = fakeChatDatabase();
  const conversations = load('app/api/chat/conversations/route.ts');
  const conversation = load('app/api/chat/conversations/[id]/route.ts');
  const params = (id) => ({ params: Promise.resolve({ id }) });
  assert.equal((await conversations.GET(new Request('http://localhost/api/chat/conversations'))).status, 401);
  assert.equal((await conversation.GET(new Request(`http://localhost/api/chat/conversations/${CHAT}`), params(CHAT))).status, 401);
  db.conversation.ownerId = 'owner-2';
  assert.equal((await conversation.GET(new Request(`http://localhost/api/chat/conversations/${CHAT}`, { headers: signedIn }), params(CHAT))).status, 404);
});

test('the chat route rejects bad bodies and unknown chats before calling the model', async () => {
  db = fakeChatDatabase();
  const chat = load('app/api/chat/route.ts');
  const post = (body) => chat.POST(new Request('http://localhost/api/chat', { method: 'POST', headers: signedIn, body }));
  assert.equal((await post('not json')).status, 400);
  assert.equal((await post(JSON.stringify({ id: CHAT }))).status, 400);
  assert.equal((await post(JSON.stringify({ id: CHAT, message: userMessage, trigger: 'delete-everything' }))).status, 400);
  assert.equal((await post(JSON.stringify({ id: '99999999-2222-4333-8444-555555555555', message: userMessage }))).status, 404);
  assert.equal((await post(JSON.stringify({ id: CHAT, message: { id: 'bad', role: 'user', parts: 'nope' } }))).status, 400);
  assert.equal(db.calls.filter((call) => call.model === 'chatMessage').length, 0, 'nothing was saved');
});
