'use client';

import { useCallback, useEffect, useState } from 'react';
import { Check, Loader2, RotateCcw, Sparkles, X } from 'lucide-react';
import { toast } from 'sonner';
import { reviewApi, type DocumentReview, type ReviewFinding } from '@/lib/ai-api';
import { getErrorMessage } from '@/lib/utils';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

const SEVERITY: Record<ReviewFinding['severity'], [string, string]> = {
  high: ['High', 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'],
  medium: ['Medium', 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400'],
  low: ['Low', 'bg-muted text-muted-foreground'],
};
const TYPE: Record<ReviewFinding['type'], string> = { missing: 'Missing', contradiction: 'Contradiction', vague: 'Vague' };
const POLL_MS = 3000;

/**
 * AI review of the document: findings on what its clauses and controls require,
 * contradictions with the SoA and vague wording. Advice only: it never blocks
 * submission or approval; each finding is accepted or dismissed by a person.
 */
export function ReviewCard({ projectId, documentId, canEdit }: { projectId: string; documentId: string; canEdit: boolean }) {
  const [review, setReview] = useState<DocumentReview | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [starting, setStarting] = useState(false);

  const load = useCallback(async () => {
    try {
      setReview(await reviewApi.latest(projectId, documentId));
    } catch {
      // The review panel is optional: the document page works without it.
    } finally {
      setLoaded(true);
    }
  }, [projectId, documentId]);

  useEffect(() => { void load(); }, [load]);

  const running = review?.status === 'QUEUED' || review?.status === 'RUNNING';
  useEffect(() => {
    if (!running) return;
    const t = setInterval(load, POLL_MS);
    return () => clearInterval(t);
  }, [running, load]);

  const start = async () => {
    setStarting(true);
    try {
      setReview(await reviewApi.start(projectId, documentId));
    } catch (err) {
      toast.error(getErrorMessage(err, 'The AI review could not start'));
    } finally {
      setStarting(false);
    }
  };

  const decide = async (f: ReviewFinding, state: ReviewFinding['state']) => {
    try {
      await reviewApi.decide(projectId, f.id, state);
      setReview((r) => r && { ...r, findings: r.findings.map((x) => (x.id === f.id ? { ...x, state } : x)) });
    } catch (err) {
      toast.error(getErrorMessage(err, 'The decision could not be saved'));
    }
  };

  if (!loaded) return null;
  const open = review?.findings.filter((f) => f.state === 'OPEN').length ?? 0;

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-base flex items-center gap-2"><Sparkles className="h-4 w-4 text-[var(--brand-orange)]" />AI review</CardTitle>
          {canEdit && !running && (
            <Button size="sm" variant="outline" onClick={start} disabled={starting}>
              {starting ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : review ? <RotateCcw className="h-4 w-4 mr-1.5" /> : <Sparkles className="h-4 w-4 mr-1.5" />}
              {review ? 'Review again' : 'Review this document'}
            </Button>
          )}
        </div>
        <CardDescription>
          Checks the saved document against the ISO 27001 clauses and controls it covers and your Statement of Applicability, like an auditor would.
          It is advice only: it never blocks submitting or approving the document.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {!review && <p className="text-sm text-muted-foreground">No review yet.</p>}
        {running && (
          <p className="text-sm flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" />Review running… this takes about a minute. You can keep working or leave this page.</p>
        )}
        {review?.status === 'FAILED' && <p className="text-sm text-destructive">{review.error}</p>}
        {review?.status === 'DONE' && (
          <>
            <p className="text-xs text-muted-foreground">
              Reviewed {new Date(review.completed_at ?? review.created_at).toLocaleString()} · {review.findings.length} finding(s), {open} open
              {review.outdated && <span className="text-amber-600 dark:text-amber-400"> · the document changed since this review</span>}
            </p>
            {review.findings.length === 0 && <p className="text-sm">No problems found.</p>}
            {review.findings.map((f) => (
              <div key={f.id} className={`rounded-lg border p-3 space-y-1.5 text-sm ${f.state !== 'OPEN' ? 'opacity-60' : ''}`}>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className={SEVERITY[f.severity][1]}>{SEVERITY[f.severity][0]}</Badge>
                  <Badge variant="outline">{TYPE[f.type]}</Badge>
                  <span className="text-xs font-medium">{f.ref}{f.ref_title && ` ${f.ref_title}`}</span>
                  {f.state !== 'OPEN' && <span className="ml-auto text-xs text-muted-foreground">{f.state === 'ACCEPTED' ? 'Accepted' : 'Dismissed'}</span>}
                </div>
                {f.quote && <blockquote className="border-l-2 border-[var(--brand-orange)] pl-2 text-xs italic">“{f.quote}”</blockquote>}
                <p>{f.explanation}</p>
                <p className="text-xs text-muted-foreground"><span className="font-medium">Suggestion:</span> {f.suggestion}</p>
                {canEdit && (
                  <div className="flex justify-end gap-2">
                    {f.state === 'OPEN' ? (
                      <>
                        <Button size="sm" variant="ghost" onClick={() => decide(f, 'DISMISSED')}><X className="h-3.5 w-3.5 mr-1" />Dismiss</Button>
                        <Button size="sm" variant="outline" onClick={() => decide(f, 'ACCEPTED')}><Check className="h-3.5 w-3.5 mr-1" />Accept</Button>
                      </>
                    ) : (
                      <Button size="sm" variant="ghost" onClick={() => decide(f, 'OPEN')}>Undo</Button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </>
        )}
      </CardContent>
    </Card>
  );
}
