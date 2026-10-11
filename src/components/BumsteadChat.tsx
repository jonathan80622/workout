'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport, isToolUIPart, getToolName, lastAssistantMessageIsCompleteWithToolCalls } from 'ai';
import { Check, Loader2, Plus, Send, Square, Trash2, X } from 'lucide-react';
import type { BumsteadUIMessage } from '@/src/server/chat/bumstead';
import { EditToolInput, EditToolName, isEditToolName } from '@/src/chat/editTools';

type ChatSummary = { id: string; title: string; updatedAt: string };

/** Applies an approved edit to the app's state and returns what changed; throws when it cannot. */
export type ApplyBumsteadEdit = <NAME extends EditToolName>(name: NAME, input: EditToolInput<NAME>) => string;

const readToolLabels: Record<string, string> = {
  getRecentWorkouts: 'Looked up recent workouts',
  getExerciseHistory: 'Looked up exercise history',
  getCurrentSession: 'Checked the current session',
  getTrainingPlan: 'Read the training plan',
  getBodyWeights: 'Read body weights',
};

async function jsonOrThrow<T>(response: Response, fallback: string): Promise<T> {
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.error || `${fallback} (HTTP ${response.status}).`);
  return data as T;
}

export function BumsteadChat({ onApplyEdit }: { onApplyEdit: ApplyBumsteadEdit }) {
  const [chats, setChats] = useState<ChatSummary[]>([]);
  const [selected, setSelected] = useState<{ id: string; messages: BumsteadUIMessage[] } | null>(null);
  const [status, setStatus] = useState('Loading chats...');

  const openChat = async (id: string) => {
    setStatus('Loading chat...');
    try {
      const chat = await jsonOrThrow<{ id: string; messages: BumsteadUIMessage[] }>(await fetch(`/api/chat/conversations/${id}`), 'Could not load the chat');
      setSelected(chat);
      setStatus('');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Could not load the chat.');
    }
  };

  const newChat = async () => {
    try {
      const chat = await jsonOrThrow<ChatSummary>(await fetch('/api/chat/conversations', { method: 'POST' }), 'Could not start a chat');
      setChats((prev) => [chat, ...prev]);
      setSelected({ id: chat.id, messages: [] });
      setStatus('');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Could not start a chat.');
    }
  };

  const deleteChat = async (id: string) => {
    if (!window.confirm('Delete this chat?')) return;
    try {
      await jsonOrThrow(await fetch(`/api/chat/conversations/${id}`, { method: 'DELETE' }), 'Could not delete the chat');
      setChats((prev) => prev.filter((chat) => chat.id !== id));
      if (selected?.id === id) setSelected(null);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Could not delete the chat.');
    }
  };

  useEffect(() => {
    (async () => {
      try {
        const { conversations } = await jsonOrThrow<{ conversations: ChatSummary[] }>(await fetch('/api/chat/conversations'), 'Could not load chats');
        setChats(conversations);
        if (conversations[0]) await openChat(conversations[0].id);
        else setStatus('');
      } catch (error) {
        setStatus(error instanceof Error ? error.message : 'Could not load chats.');
      }
    })();
  }, []);

  return (
    <div className="flex flex-col gap-3 min-h-[calc(100vh-11rem)]">
      <div className="flex items-center gap-2">
        <select
          value={selected?.id || ''}
          onChange={(event) => event.target.value && openChat(event.target.value)}
          className="flex-1 min-w-0 bg-[#181412] border border-[#382f29] rounded-2xl px-3 py-2.5 text-sm text-[#f7f3ee]"
          aria-label="Chat"
        >
          {!selected && <option value="">{chats.length ? 'Choose a chat' : 'No chats yet'}</option>}
          {chats.map((chat) => <option key={chat.id} value={chat.id}>{chat.title}</option>)}
        </select>
        {selected && (
          <button onClick={() => deleteChat(selected.id)} aria-label="Delete chat" className="p-2.5 rounded-2xl border border-[#382f29] text-[#a39588] hover:text-[#f7f3ee]">
            <Trash2 className="w-4 h-4" />
          </button>
        )}
        <button onClick={newChat} className="flex items-center gap-1 px-3 py-2.5 rounded-2xl bg-[#d97724]/20 border border-[#d97724]/40 text-[#f5c999] text-xs font-syne font-bold">
          <Plus className="w-4 h-4" /> New
        </button>
      </div>
      {status && <p role="status" className="text-xs text-[#a39588]">{status}</p>}
      {selected ? (
        <ChatThread
          key={selected.id}
          id={selected.id}
          initialMessages={selected.messages}
          onApplyEdit={onApplyEdit}
          onTurnFinished={() => fetch('/api/chat/conversations').then((response) => jsonOrThrow<{ conversations: ChatSummary[] }>(response, 'Could not load chats'))
            .then(({ conversations }) => setChats(conversations))
            .catch((error) => console.error('[bumstead] refreshing chats failed:', error))}
        />
      ) : !status && (
        <div className="bg-[#181412] border border-[#382f29] rounded-3xl p-6 text-center space-y-2">
          <h3 className="text-lg font-serif font-bold text-[#f7f3ee]">Ask Bumstead</h3>
          <p className="text-xs text-[#a39588]">It reads your workouts, plan and weigh-ins, and can schedule sessions or add exercises once you approve.</p>
          <button onClick={newChat} className="mt-2 w-full py-3 bg-gradient-to-r from-[#d97724] via-[#c86d51] to-[#e6a15c] text-[#0c0a09] font-syne font-bold text-xs rounded-2xl">
            Start a chat
          </button>
        </div>
      )}
    </div>
  );
}

/** True once every edit in the latest step has an answer, so Bumstead can continue with the results. */
function editsAnswered({ messages }: { messages: BumsteadUIMessage[] }) {
  const last = messages[messages.length - 1];
  if (!last || last.role !== 'assistant') return false;
  let stepStart = last.parts.length - 1;
  while (stepStart >= 0 && last.parts[stepStart].type !== 'step-start') stepStart -= 1;
  const lastStep = last.parts.slice(stepStart + 1);
  const hasEdit = lastStep.some((part) => isToolUIPart(part) && isEditToolName(getToolName(part)));
  return hasEdit && lastAssistantMessageIsCompleteWithToolCalls({ messages });
}

function ChatThread({ id, initialMessages, onApplyEdit, onTurnFinished }: {
  id: string;
  initialMessages: BumsteadUIMessage[];
  onApplyEdit: ApplyBumsteadEdit;
  onTurnFinished: () => void;
}) {
  const [input, setInput] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const { messages, sendMessage, status, error, stop, regenerate, addToolOutput, clearError } = useChat<BumsteadUIMessage>({
    id,
    messages: initialMessages,
    resume: true,
    transport: new DefaultChatTransport({
      api: '/api/chat',
      prepareSendMessagesRequest: ({ id: chatId, messages: all, trigger }) => ({
        body: {
          id: chatId,
          trigger,
          message: all[all.length - 1],
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        },
      }),
    }),
    sendAutomaticallyWhen: editsAnswered,
    onFinish: onTurnFinished,
    onError: (chatError) => console.error('[bumstead] chat failed:', chatError),
  });
  const busy = status === 'submitted' || status === 'streaming';

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, status]);

  const send = (event: React.FormEvent) => {
    event.preventDefault();
    const text = input.trim();
    if (!text || busy) return;
    clearError();
    sendMessage({ text });
    setInput('');
  };

  const stopReply = () => {
    stop();
    fetch(`/api/chat/${id}/stop`, { method: 'POST' }).catch((stopError) => console.error('[bumstead] stop failed:', stopError));
  };

  const answerEdit = (name: EditToolName, toolCallId: string, input: unknown, approved: boolean) => {
    if (!approved) {
      addToolOutput({ tool: name, toolCallId, output: { applied: false, message: 'The user declined this change.' } });
      return;
    }
    try {
      const message = onApplyEdit(name, input as EditToolInput<typeof name>);
      addToolOutput({ tool: name, toolCallId, output: { applied: true, message } });
    } catch (applyError) {
      addToolOutput({ tool: name, toolCallId, state: 'output-error', errorText: applyError instanceof Error ? applyError.message : 'Could not apply the change.' });
    }
  };

  return (
    <div className="flex flex-col flex-1 gap-3">
      <div className="flex-1 space-y-3">
        {messages.length === 0 && (
          <p className="text-xs text-[#a39588]">Try "How has my leg press progressed?" or "Schedule legs for Friday at 7am."</p>
        )}
        {messages.map((message) => (
          <div key={message.id} className={message.role === 'user' ? 'flex justify-end' : 'space-y-2'}>
            {message.parts.map((part, index) => {
              const key = `${message.id}-${index}`;
              if (part.type === 'text') {
                return (
                  <div key={key} className={`whitespace-pre-wrap text-sm leading-relaxed rounded-3xl px-4 py-3 ${
                    message.role === 'user'
                      ? 'max-w-[85%] bg-[#d97724]/20 border border-[#d97724]/40 text-[#f7f3ee]'
                      : 'bg-[#181412] border border-[#382f29] text-[#e8e0d5]'
                  }`}>
                    {part.text}
                  </div>
                );
              }
              if (!isToolUIPart(part)) return null;
              const name = getToolName(part);
              if (!isEditToolName(name)) {
                return (
                  <p key={key} className="flex items-center gap-1.5 text-[11px] text-[#8c7e72]">
                    {part.state === 'output-available' ? <Check className="w-3 h-3" /> : part.state === 'output-error' ? <X className="w-3 h-3" /> : <Loader2 className="w-3 h-3 animate-spin" />}
                    {readToolLabels[name] || name}
                  </p>
                );
              }
              return (
                <EditCard
                  key={key}
                  name={name}
                  part={part}
                  disabled={busy}
                  onAnswer={(approved) => answerEdit(name, part.toolCallId, part.input, approved)}
                />
              );
            })}
          </div>
        ))}
        {status === 'submitted' && <Loader2 className="w-4 h-4 animate-spin text-[#e6a15c]" />}
        {error && (
          <div className="flex items-center justify-between gap-2 text-xs text-[#f5a99a] bg-[#2a1512] border border-[#5c2a22] rounded-2xl px-3 py-2">
            <span>{error.message || 'Something went wrong.'}</span>
            <button onClick={() => { clearError(); regenerate(); }} className="font-bold underline">Retry</button>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={send} className="sticky bottom-24 flex items-end gap-2 bg-[#0c0a09] pt-1">
        <textarea
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) send(event);
          }}
          rows={1}
          placeholder="Ask Bumstead..."
          className="flex-1 resize-none bg-[#181412] border border-[#382f29] rounded-2xl px-3 py-2.5 text-sm text-[#f7f3ee] placeholder:text-[#8c7e72]"
        />
        {busy ? (
          <button type="button" onClick={stopReply} aria-label="Stop reply" className="p-3 rounded-2xl border border-[#382f29] text-[#f5c999]">
            <Square className="w-4 h-4" />
          </button>
        ) : (
          <button type="submit" disabled={!input.trim()} aria-label="Send" className="p-3 rounded-2xl bg-gradient-to-r from-[#d97724] to-[#e6a15c] text-[#0c0a09] disabled:opacity-40">
            <Send className="w-4 h-4" />
          </button>
        )}
      </form>
    </div>
  );
}

function describeEdit(name: EditToolName, input: any): string {
  if (!input) return 'Preparing a change...';
  switch (name) {
    case 'scheduleSession':
      return `Schedule "${input.title ?? ''}" for ${input.scheduledDate ? new Date(input.scheduledDate).toLocaleString() : '...'}`;
    case 'renameWorkout':
      return `Rename a workout to "${input.title ?? ''}"`;
    case 'moveWorkoutDate':
      return `Move a workout to ${input.date ? new Date(input.date).toLocaleString() : '...'}`;
    case 'addExerciseToActiveWorkout':
      return `Add ${input.exerciseName ?? 'an exercise'}: ${(input.sets || []).map((set: any) => `${set?.weight ?? '?'} ${set?.weightUnit ?? ''} x ${set?.reps ?? '?'}`).join(', ')}`;
  }
}

function EditCard({ name, part, disabled, onAnswer }: {
  name: EditToolName;
  part: { state: string; input?: unknown; output?: unknown; errorText?: string };
  disabled: boolean;
  onAnswer: (approved: boolean) => void;
}) {
  const output = part.output as { applied: boolean; message: string } | undefined;
  return (
    <div className="bg-[#181412] border border-[#d97724]/40 rounded-3xl px-4 py-3 space-y-2">
      <p className="text-[10px] uppercase tracking-wide text-[#e6a15c] font-syne">Suggested change</p>
      <p className="text-sm text-[#f7f3ee]">{describeEdit(name, part.input)}</p>
      {part.state === 'input-available' && (
        <div className="flex gap-2">
          <button disabled={disabled} onClick={() => onAnswer(true)} className="flex-1 py-2 rounded-2xl bg-gradient-to-r from-[#d97724] to-[#e6a15c] text-[#0c0a09] text-xs font-syne font-bold disabled:opacity-40">Approve</button>
          <button disabled={disabled} onClick={() => onAnswer(false)} className="flex-1 py-2 rounded-2xl border border-[#382f29] text-[#a39588] text-xs font-syne font-bold disabled:opacity-40">Decline</button>
        </div>
      )}
      {part.state === 'output-available' && output && (
        <p className={`text-xs ${output.applied ? 'text-[#9fd9a8]' : 'text-[#a39588]'}`}>{output.applied ? `Applied: ${output.message}` : 'Declined.'}</p>
      )}
      {part.state === 'output-error' && <p className="text-xs text-[#f5a99a]">Not applied: {part.errorText}</p>}
    </div>
  );
}
