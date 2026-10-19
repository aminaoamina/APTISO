'use client';

import { useState } from 'react';
import type { Editor } from '@tiptap/react';
import { AlertTriangle, Loader2, Sparkles, X } from 'lucide-react';
import { aiApi } from '@/lib/ai-api';
import { getErrorMessage } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const INSTRUCTIONS = [
  ['clearer', 'Clearer'],
  ['formal', 'More formal'],
  ['shorter', 'Shorter'],
] as const;

export interface ImproveTarget {
  from: number;
  to: number;
  text: string;
}

/**
 * Rewrites the selected passage. The new text streams in next to the
 * original; it replaces the selection only when the person clicks Replace.
 */
export function ImprovePanel({ editor, target, projectId, documentId, onClose }: {
  editor: Editor;
  target: ImproveTarget;
  projectId: string;
  documentId: string;
  onClose: () => void;
}) {
  const [custom, setCustom] = useState('');
  const [result, setResult] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ run_id: string; added_facts: string[] } | null>(null);

  const run = async (instruction: string) => {
    setBusy(true);
    setError(null);
    setResult('');
    setDone(null);
    try {
      setDone(await aiApi.improve(projectId, documentId, target.text, instruction, setResult));
    } catch (err) {
      setError(getErrorMessage(err, 'The AI assistant is not available right now'));
    } finally {
      setBusy(false);
    }
  };

  const close = (outcome: 'ACCEPTED' | 'DISMISSED') => {
    if (done) void aiApi.decide(projectId, done.run_id, outcome);
    onClose();
  };

  const replace = () => {
    const paragraphs = result.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
    editor.chain().focus().insertContentAt(
      { from: target.from, to: target.to },
      paragraphs.length > 1 ? paragraphs.map((p) => ({ type: 'paragraph', content: [{ type: 'text', text: p }] })) : result.trim(),
    ).run();
    close('ACCEPTED');
  };

  return (
    <div className="border-b border-border bg-muted/30 px-4 py-3 space-y-3 text-sm">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium flex items-center gap-1.5 text-[var(--brand-orange)]"><Sparkles className="h-3.5 w-3.5" />Improve the selected text</p>
        <button type="button" aria-label="Close" onClick={() => close('DISMISSED')} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {INSTRUCTIONS.map(([key, label]) => (
          <Button key={key} type="button" size="sm" variant="outline" disabled={busy} onClick={() => run(key)}>{label}</Button>
        ))}
        <form className="flex flex-1 min-w-56 gap-2" onSubmit={(e) => { e.preventDefault(); if (custom.trim()) void run(custom.trim()); }}>
          <Input value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="Or your own instruction…" maxLength={300} className="h-8" />
          <Button type="submit" size="sm" disabled={busy || !custom.trim()}>Go</Button>
        </form>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <p className="text-xs text-muted-foreground mb-1">Original</p>
          <p className="whitespace-pre-wrap rounded-md border bg-background p-2 text-xs max-h-48 overflow-y-auto">{target.text}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">Improved {busy && <Loader2 className="h-3 w-3 animate-spin" />}</p>
          <p className="whitespace-pre-wrap rounded-md border bg-background p-2 text-xs max-h-48 overflow-y-auto min-h-12">
            {result || <span className="text-muted-foreground">{busy ? 'Writing…' : 'Choose how to improve it.'}</span>}
          </p>
        </div>
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
      {done && done.added_facts.length > 0 && (
        <p className="text-xs text-amber-700 dark:text-amber-400 flex items-start gap-1.5">
          <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          The new text contains details that are not in your text: {done.added_facts.join(', ')}. Check them before replacing.
        </p>
      )}
      {done && (
        <div className="flex justify-end gap-2">
          <Button type="button" size="sm" variant="ghost" onClick={() => close('DISMISSED')}>Discard</Button>
          <Button type="button" size="sm" onClick={replace}>Replace</Button>
        </div>
      )}
    </div>
  );
}
