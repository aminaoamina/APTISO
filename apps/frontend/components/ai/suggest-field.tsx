'use client';

import { useState } from 'react';
import { Loader2, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { aiApi, Suggestion } from '@/lib/ai-api';
import { getErrorMessage } from '@/lib/utils';
import { Button } from '@/components/ui/button';

/**
 * ✨ Suggest for one wizard question: the proposal is shown with the project
 * data it comes from, and nothing is filled in until the person chooses.
 */
export function SuggestButton({ onSuggestion, request }: {
  onSuggestion: (s: Suggestion | null) => void;
  request: () => Promise<Suggestion>;
}) {
  const [busy, setBusy] = useState(false);
  const run = async () => {
    setBusy(true);
    onSuggestion(null);
    try {
      onSuggestion(await request());
    } catch (err) {
      toast.error(getErrorMessage(err, 'The AI assistant is not available right now'));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Button type="button" size="sm" variant="ghost" className="h-7 px-2 text-xs text-[var(--brand-orange)]" onClick={run} disabled={busy}>
      {busy ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Sparkles className="h-3.5 w-3.5 mr-1" />}
      {busy ? 'Thinking…' : 'Suggest'}
    </Button>
  );
}

export function SuggestionPanel({ projectId, suggestion, value, onChange, onClose }: {
  projectId: string;
  suggestion: Suggestion;
  value: string;
  onChange: (value: string) => void;
  onClose: () => void;
}) {
  const decide = (outcome: 'ACCEPTED' | 'DISMISSED') => {
    if (suggestion.run_id) void aiApi.decide(projectId, suggestion.run_id, outcome);
    onClose();
  };

  if (!suggestion.answer) {
    return (
      <div className="mt-2 rounded-md border border-dashed bg-muted/30 p-3 text-xs">
        <p className="font-medium flex items-center gap-1.5"><Sparkles className="h-3.5 w-3.5" />Not enough information to suggest this</p>
        {suggestion.missing.length > 0 && (
          <ul className="mt-1 list-disc pl-5 text-muted-foreground">{suggestion.missing.map((m) => <li key={m}>Needed: {m}</li>)}</ul>
        )}
        <div className="mt-2 flex justify-end"><Button size="sm" variant="ghost" onClick={() => decide('DISMISSED')}>Close</Button></div>
      </div>
    );
  }

  return (
    <div className="mt-2 rounded-md border border-[var(--brand-orange)]/40 bg-[var(--brand-orange)]/5 p-3 text-sm space-y-2">
      <p className="text-xs font-medium flex items-center gap-1.5 text-[var(--brand-orange)]"><Sparkles className="h-3.5 w-3.5" />Suggestion</p>
      <p className="whitespace-pre-wrap">{suggestion.answer}</p>
      {suggestion.sources.length > 0 && (
        <div className="text-xs text-muted-foreground space-y-0.5">
          <p className="font-medium">Based on:</p>
          {suggestion.sources.map((s, i) => <p key={i}>{s.label}: <q className="italic">{s.quote}</q></p>)}
        </div>
      )}
      {suggestion.missing.length > 0 && <p className="text-xs text-muted-foreground">Still needed: {suggestion.missing.join('; ')}</p>}
      <div className="flex flex-wrap justify-end gap-2">
        <Button size="sm" variant="ghost" onClick={() => decide('DISMISSED')}>Dismiss</Button>
        {value.trim() && (
          <Button size="sm" variant="outline" onClick={() => { onChange(`${value.trim()}\n${suggestion.answer}`); decide('ACCEPTED'); }}>Append</Button>
        )}
        <Button size="sm" onClick={() => { onChange(suggestion.answer); decide('ACCEPTED'); }}>Use</Button>
      </div>
    </div>
  );
}
