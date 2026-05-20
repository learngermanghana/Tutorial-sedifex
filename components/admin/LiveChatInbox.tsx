'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { MessageCircle, RefreshCcw, Send, XCircle } from 'lucide-react';
import { StatusBadge } from './ui';

type Message = {
  id: string;
  sender?: string;
  authorName?: string;
  text?: string;
  createdAt?: unknown;
};

type Conversation = {
  id: string;
  status?: string;
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
  storeName?: string;
  storeId?: string;
  pageUrl?: string;
  lastMessage?: string;
  lastMessageSender?: string;
  lastMessageAt?: unknown;
  adminUnread?: number;
  messages?: Message[];
};

type ApiResponse = {
  ok?: boolean;
  error?: string;
  conversations?: Conversation[];
};

function formatTime(value: unknown) {
  if (!value) return '—';
  if (typeof value === 'string') {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
  }
  if (typeof value === 'object' && value && 'seconds' in value) {
    const seconds = Number((value as { seconds?: unknown }).seconds || 0);
    if (seconds > 0) return new Date(seconds * 1000).toLocaleString();
  }
  return '—';
}

function toneFor(status?: string): 'green' | 'yellow' | 'blue' | 'slate' | 'red' {
  if (status === 'open') return 'yellow';
  if (status === 'replied') return 'blue';
  if (status === 'closed') return 'slate';
  if (status === 'urgent') return 'red';
  return 'slate';
}

export default function LiveChatInbox() {
  const [status, setStatus] = useState('all');
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState('');
  const [reply, setReply] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  const active = useMemo(
    () => conversations.find((conversation) => conversation.id === activeId) || conversations[0] || null,
    [activeId, conversations],
  );

  async function loadChats() {
    try {
      setLoading(true);
      setError('');
      const params = new URLSearchParams({ status, limit: '75' });
      const response = await fetch(`/api/admin/live-chat?${params.toString()}`, { cache: 'no-store' });
      const data = (await response.json()) as ApiResponse;
      if (!response.ok || !data.ok) throw new Error(data.error || 'Unable to load live chat.');
      const next = data.conversations || [];
      setConversations(next);
      setActiveId((current) => (current && next.some((item) => item.id === current) ? current : next[0]?.id || ''));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load live chat.');
      setConversations([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadChats();
    const timer = window.setInterval(() => void loadChats(), 15000);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  async function sendReply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!active || !reply.trim()) return;
    try {
      setSending(true);
      const response = await fetch('/api/admin/live-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId: active.id, text: reply.trim(), status: 'replied' }),
      });
      const data = (await response.json()) as ApiResponse;
      if (!response.ok || !data.ok) throw new Error(data.error || 'Unable to send reply.');
      setReply('');
      await loadChats();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to send reply.');
    } finally {
      setSending(false);
    }
  }

  async function closeChat() {
    if (!active) return;
    try {
      setSending(true);
      const response = await fetch('/api/admin/live-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId: active.id, text: 'Conversation closed by support.', status: 'closed' }),
      });
      const data = (await response.json()) as ApiResponse;
      if (!response.ok || !data.ok) throw new Error(data.error || 'Unable to close chat.');
      await loadChats();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to close chat.');
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[380px_1fr]">
      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-slate-950">Sedifex Market chats</h2>
              <p className="mt-1 text-xs text-slate-500">Messages from marketplace visitors.</p>
            </div>
            <button onClick={loadChats} className="rounded-xl border border-slate-200 p-2 text-slate-500 hover:bg-slate-50" type="button">
              <RefreshCcw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
          <select value={status} onChange={(event) => setStatus(event.target.value)} className="mt-4 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm">
            <option value="all">All chats</option>
            <option value="open">Open</option>
            <option value="replied">Replied</option>
            <option value="closed">Closed</option>
          </select>
        </div>

        {error ? <p className="border-b border-rose-100 bg-rose-50 p-3 text-sm text-rose-700">{error}</p> : null}

        <div className="max-h-[650px] overflow-y-auto p-2">
          {conversations.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-500">
              No live chats yet.
            </div>
          ) : (
            conversations.map((conversation) => {
              const activeConversation = active?.id === conversation.id;
              return (
                <button
                  key={conversation.id}
                  type="button"
                  onClick={() => setActiveId(conversation.id)}
                  className={`mb-2 w-full rounded-2xl border p-4 text-left transition ${activeConversation ? 'border-indigo-200 bg-indigo-50' : 'border-slate-200 bg-white hover:bg-slate-50'}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-950">{conversation.customerName || 'Website visitor'}</p>
                      <p className="truncate text-xs text-slate-500">{conversation.storeName || conversation.storeId || 'Sedifex Market'}</p>
                    </div>
                    <StatusBadge tone={toneFor(conversation.status)}>{conversation.status || 'open'}</StatusBadge>
                  </div>
                  <p className="mt-3 line-clamp-2 text-sm text-slate-600">{conversation.lastMessage || 'No message preview'}</p>
                  <p className="mt-2 text-xs text-slate-400">{formatTime(conversation.lastMessageAt)}</p>
                </button>
              );
            })
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        {active ? (
          <div className="flex min-h-[720px] flex-col">
            <div className="border-b border-slate-200 p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <MessageCircle className="h-5 w-5 text-indigo-600" />
                    <h2 className="text-lg font-semibold text-slate-950">{active.customerName || 'Website visitor'}</h2>
                  </div>
                  <p className="mt-2 text-sm text-slate-500">{active.customerPhone || 'No phone'} · {active.customerEmail || 'No email'}</p>
                  <p className="mt-1 text-xs text-slate-400">Page: {active.pageUrl || 'Unknown page'}</p>
                </div>
                <button onClick={closeChat} type="button" disabled={sending} className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                  <XCircle className="h-4 w-4" /> Close
                </button>
              </div>
            </div>

            <div className="flex-1 space-y-3 overflow-y-auto bg-slate-50 p-5">
              {(active.messages || []).map((message) => {
                const isAdmin = message.sender === 'admin' || message.sender === 'staff';
                return (
                  <div key={message.id} className={`flex ${isAdmin ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm shadow-sm ${isAdmin ? 'bg-indigo-600 text-white' : 'bg-white text-slate-800 ring-1 ring-slate-200'}`}>
                      <p>{message.text || ''}</p>
                      <p className={`mt-2 text-[11px] ${isAdmin ? 'text-indigo-100' : 'text-slate-400'}`}>{message.authorName || message.sender || 'visitor'} · {formatTime(message.createdAt)}</p>
                    </div>
                  </div>
                );
              })}
            </div>

            <form onSubmit={sendReply} className="border-t border-slate-200 p-4">
              <textarea
                value={reply}
                onChange={(event) => setReply(event.target.value)}
                placeholder="Type your reply..."
                rows={3}
                className="w-full resize-none rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
              />
              <div className="mt-3 flex justify-end">
                <button type="submit" disabled={sending || !reply.trim()} className="inline-flex items-center gap-2 rounded-2xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50">
                  <Send className="h-4 w-4" /> {sending ? 'Sending...' : 'Send reply'}
                </button>
              </div>
            </form>
          </div>
        ) : (
          <div className="flex min-h-[720px] items-center justify-center p-8 text-center text-slate-500">
            Select a conversation to reply.
          </div>
        )}
      </section>
    </div>
  );
}
