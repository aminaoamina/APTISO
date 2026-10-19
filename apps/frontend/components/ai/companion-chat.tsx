'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { AlertCircle, Bot, History, Loader2, MessageCircle, RotateCcw, Send, Trash2, X } from 'lucide-react';
import { chatApi, nextActionsApi, type ChatCitation, type ChatConversation, type ChatTurn, type NextAction } from '@/lib/ai-api';
import { getErrorMessage } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

interface Message extends ChatTurn {
  citations?: ChatCitation[];
  error?: boolean;
}

const EXAMPLES = ['Are we ready for A.8.13?', 'What does our security policy say about objectives?', 'What does ISO 27001 require for internal audits?'];
const MARKER = /\[([SF]\d{1,2}(?:\s*[,;]\s*[SF]\d{1,2})*)\]/g;

/** Citation markers the answer used, kept only when they point to a real source. */
function cleanMarkers(text: string, citations: ChatCitation[]) {
  const valid = new Set(citations.map((c) => c.id));
  return text.replace(MARKER, (_, group: string) => {
    const kept = (group.match(/[SF]\d{1,2}/g) ?? []).filter((id) => valid.has(id));
    return kept.length ? `[${kept.join(', ')}]` : '';
  });
}

/** The last conversation, reopened with the panel (a convenience: the history itself is on the server). */
const lastKey = (projectId: string) => `aptiso.companion.${projectId}`;
const remember = (projectId: string, id: string | null) => {
  try {
    if (id) localStorage.setItem(lastKey(projectId), id);
    else localStorage.removeItem(lastKey(projectId));
  } catch { /* storage unavailable */ }
};
const recall = (projectId: string) => {
  try { return localStorage.getItem(lastKey(projectId)); } catch { return null; }
};

/**
 * The ISO 27001 companion: answers from the project's documents and records
 * the person may see, with the sources it used.
 */
export function CompanionChat({ orgId, projectId }: { orgId: string; projectId: string }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  // null: the chat is shown; a list: the history is shown.
  const [history, setHistory] = useState<ChatConversation[] | null>(null);
  const bottom = useRef<HTMLDivElement>(null);
  // On the whiteboard, stay clear of the canvas controls in the bottom-right corner.
  const lifted = usePathname().endsWith('/whiteboard');
  // The greeting: what this person should do next (loaded each time the panel opens).
  const [actions, setActions] = useState<NextAction[] | null>(null);
  useEffect(() => {
    if (!open) return;
    setActions(null);
    nextActionsApi.get(projectId).then((r) => setActions(r.actions)).catch(() => setActions([]));
  }, [open, projectId]);

  useEffect(() => { bottom.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const load = async (id: string) => {
    try {
      const c = await chatApi.conversation(projectId, id);
      setMessages(c.messages.map((m) => ({ role: m.role, content: m.citations ? cleanMarkers(m.content, m.citations) : m.content, citations: m.citations ?? undefined })));
      setConversationId(id);
      remember(projectId, id);
    } catch {
      remember(projectId, null);
    }
    setHistory(null);
  };

  // Opening the panel brings back the last conversation.
  useEffect(() => {
    const last = open && !conversationId ? recall(projectId) : null;
    if (last) void load(last);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, projectId]);

  const newConversation = () => {
    setMessages([]);
    setConversationId(null);
    setHistory(null);
    remember(projectId, null);
  };

  const showHistory = async () => {
    if (history) return setHistory(null);
    setHistory(await chatApi.conversations(projectId).catch(() => []));
  };

  const remove = async (id: string) => {
    await chatApi.deleteConversation(projectId, id).catch(() => undefined);
    setHistory((h) => h?.filter((c) => c.id !== id) ?? null);
    if (id === conversationId) newConversation();
  };

  const ask = async (question: string) => {
    const text = question.trim();
    if (!text || busy) return;
    setMessages((m) => [...m, { role: 'user', content: text }, { role: 'assistant', content: '' }]);
    setInput('');
    setBusy(true);
    const update = (patch: Partial<Message>) => setMessages((m) => [...m.slice(0, -1), { ...m[m.length - 1], ...patch }]);
    try {
      let answer = '';
      const citations = await chatApi.ask(projectId, text, conversationId, (sofar) => { answer = sofar; update({ content: sofar }); }, (id) => {
        setConversationId(id);
        remember(projectId, id);
      });
      update({ content: cleanMarkers(answer, citations), citations });
    } catch (err) {
      update({ content: getErrorMessage(err, 'The AI assistant is not available right now'), error: true });
    } finally {
      setBusy(false);
    }
  };

  // Documents link to the document itself; evidence to the Audit & Evidence page.
  const href = (c: ChatCitation) => {
    const base = `/dashboard/organizations/${orgId}/projects/${projectId}`;
    if (c.source_type === 'document' && c.source_id) return `${base}/documents/${c.source_id}`;
    return c.source_type === 'evidence' ? `${base}/audit` : null;
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`fixed ${lifted ? 'bottom-24' : 'bottom-5'} right-5 z-40 inline-flex items-center gap-2 rounded-full bg-[var(--brand-orange)] px-4 py-3 text-sm font-medium text-white shadow-lg hover:opacity-90`}
      >
        <MessageCircle className="h-4 w-4" />ISO companion
      </button>
    );
  }

  return (
    <div className="fixed bottom-5 right-5 z-40 flex h-[min(600px,calc(100vh-2.5rem))] w-[min(420px,calc(100vw-2.5rem))] flex-col rounded-xl border bg-background shadow-2xl">
      <div className="flex items-center justify-between border-b px-4 py-2.5">
        <p className="text-sm font-medium flex items-center gap-2"><Bot className="h-4 w-4 text-[var(--brand-orange)]" />ISO companion</p>
        <div className="flex items-center gap-1">
          <button type="button" title="History" onClick={() => void showHistory()} disabled={busy} className={`rounded p-1.5 hover:bg-muted ${history ? 'text-[var(--brand-orange)]' : 'text-muted-foreground'}`}>
            <History className="h-4 w-4" />
          </button>
          {(messages.length > 0 || history) && (
            <button type="button" title="New conversation" onClick={newConversation} disabled={busy} className="rounded p-1.5 text-muted-foreground hover:bg-muted">
              <RotateCcw className="h-4 w-4" />
            </button>
          )}
          <button type="button" aria-label="Close" onClick={() => setOpen(false)} className="rounded p-1.5 text-muted-foreground hover:bg-muted"><X className="h-4 w-4" /></button>
        </div>
      </div>

      {history ? (
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-1 text-sm">
          <p className="text-xs font-medium pb-1">Your conversations in this project</p>
          {history.length === 0 && <p className="text-xs text-muted-foreground">No conversation yet.</p>}
          {history.map((c) => (
            <div key={c.id} className={`flex items-center gap-2 rounded-md border px-3 py-2 hover:bg-muted ${c.id === conversationId ? 'border-[var(--brand-orange)]/50' : ''}`}>
              <button type="button" onClick={() => void load(c.id)} className="min-w-0 flex-1 text-left">
                <span className="block truncate text-xs font-medium">{c.title}</span>
                <span className="block text-[11px] text-muted-foreground">{new Date(c.updated_at).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}</span>
              </button>
              <button type="button" title="Delete" onClick={() => void remove(c.id)} className="rounded p-1 text-muted-foreground hover:text-destructive">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      ) : (
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 text-sm">
        {messages.length === 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium">Your next actions</p>
            {actions === null && <p className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin" />Looking at your project…</p>}
            {actions?.length === 0 && <p className="text-xs text-muted-foreground">Nothing waiting for you right now.</p>}
            {actions?.map((a) => (
              <Link key={a.id} href={a.href} onClick={() => setOpen(false)} className="block rounded-md border px-3 py-2 text-xs hover:bg-muted">
                <span className="flex items-start gap-1.5 font-medium">
                  {a.overdue && <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0 text-destructive" />}{a.title}
                </span>
                {a.why && <span className="block text-muted-foreground mt-0.5">{a.why}</span>}
              </Link>
            ))}
          </div>
        )}
        {messages.length === 0 && (
          <div className="space-y-2 text-muted-foreground pt-2">
            <p>Ask about ISO 27001 or your project. Answers come from your documents and records, with their sources.</p>
            {EXAMPLES.map((q) => (
              <button key={q} type="button" onClick={() => ask(q)} className="block w-full rounded-md border px-3 py-2 text-left text-xs hover:bg-muted">{q}</button>
            ))}
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={m.role === 'user' ? 'flex justify-end' : ''}>
            <div className={m.role === 'user'
              ? 'max-w-[85%] rounded-lg bg-[var(--brand-orange)]/10 px-3 py-2'
              : `max-w-full rounded-lg border px-3 py-2 ${m.error ? 'border-destructive/40 text-destructive' : ''}`}>
              {m.content
                ? <p className="whitespace-pre-wrap">{m.content}</p>
                : <p className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin" />Looking in your project…</p>}
              {m.citations && m.citations.length > 0 && (
                <div className="mt-2 border-t pt-2 space-y-1 text-xs text-muted-foreground">
                  <p className="font-medium">Sources</p>
                  {m.citations.map((c) => {
                    const label = `${c.id} · ${c.title}${c.section ? ` › ${c.section}` : ''}`;
                    const link = href(c);
                    return link
                      ? <Link key={c.id} href={link} className="block text-[var(--brand-orange)] hover:underline">{label}</Link>
                      : <p key={c.id}>{label}</p>;
                  })}
                </div>
              )}
            </div>
          </div>
        ))}
        <div ref={bottom} />
      </div>
      )}

      <form className="flex items-end gap-2 border-t p-3" onSubmit={(e) => { e.preventDefault(); void ask(input); }}>
        <Textarea
          rows={2}
          value={input}
          maxLength={2000}
          placeholder="Ask a question…"
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void ask(input); } }}
          className="min-h-0 resize-none"
        />
        <Button type="submit" size="sm" disabled={busy || !input.trim()} aria-label="Send">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </form>
    </div>
  );
}
