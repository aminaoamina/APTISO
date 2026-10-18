'use client';

import { useCallback, useEffect, useState } from 'react';
import { CalendarCheck, Link2, Loader2, RotateCcw, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { evidenceApi } from '@/lib/api';
import { evidenceAnalysisApi, type EvidenceAnalysis as Analysis } from '@/lib/ai-api';
import { getErrorMessage } from '@/lib/utils';
import { usePollWhile } from '@/lib/use-poll';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

/**
 * What the AI read in an evidence file: proposals only. "Link" and "Set as
 * valid until" use the normal evidence actions, so they are checked and logged
 * like any change made by hand.
 */
export function EvidenceAnalysisView({ projectId, evidenceId, fileId, canEdit, onApplied }: {
  projectId: string;
  evidenceId: string;
  /** The current file: a new version is read again. */
  fileId: string;
  canEdit: boolean;
  onApplied: () => Promise<void>;
}) {
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try { setAnalysis(await evidenceAnalysisApi.get(projectId, evidenceId)); } catch { /* optional panel */ }
  }, [projectId, evidenceId]);
  useEffect(() => { void load(); }, [load, fileId]);
  const running = analysis?.status === 'QUEUED' || analysis?.status === 'RUNNING';
  usePollWhile(running, load);

  const act = async (action: () => Promise<unknown>, success: string) => {
    setBusy(true);
    try { await action(); toast.success(success); await onApplied(); await load(); }
    catch (err) { toast.error(getErrorMessage(err, 'The change could not be saved')); }
    finally { setBusy(false); }
  };

  if (!analysis) return null;
  if (running) {
    return <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin" />AI reading the file…</p>;
  }
  if (analysis.status === 'FAILED') {
    return (
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <Sparkles className="h-3.5 w-3.5" />{analysis.error}
        {canEdit && <Button size="sm" variant="ghost" className="h-6 px-2" disabled={busy} onClick={() => act(() => evidenceAnalysisApi.retry(projectId, evidenceId), 'Analysis restarted')}><RotateCcw className="h-3 w-3 mr-1" />Retry</Button>}
      </div>
    );
  }

  return (
    <div className="rounded-md border border-[var(--brand-orange)]/30 bg-[var(--brand-orange)]/5 p-2.5 space-y-2 text-xs">
      <p className="flex items-center gap-1.5 font-medium text-[var(--brand-orange)]">
        <Sparkles className="h-3.5 w-3.5" />AI reading{analysis.document_type && ` · ${analysis.document_type}`}
        <span className="font-normal text-muted-foreground">
          {analysis.pages != null && ` · ${analysis.pages} page(s)${analysis.ocr_pages ? `, ${analysis.ocr_pages} read from the image` : ''}`}
        </span>
      </p>
      {analysis.note && <p className="text-muted-foreground">{analysis.note}</p>}
      {analysis.summary && <p>{analysis.summary}</p>}
      {analysis.suggestions.length > 0 && (
        <div className="space-y-1">
          <p className="font-medium">Suggested links</p>
          {analysis.suggestions.map((s) => (
            <div key={s.ref} className="flex flex-wrap items-center gap-2">
              <span className="font-medium">{s.ref}</span><span>{s.title}</span>
              <Badge variant="outline" className="text-[10px]">{s.confidence === 'likely' ? 'Likely' : 'Possible'}</Badge>
              <span className="w-full text-muted-foreground">{s.reason}</span>
              {s.linked
                ? <span className="text-muted-foreground">Linked</span>
                : !s.target
                  ? <span className="text-muted-foreground">Can be linked once the control is in the Statement of Applicability</span>
                  : canEdit && (
                    <Button size="sm" variant="outline" className="h-6 px-2" disabled={busy} onClick={() => act(() => evidenceApi.link(evidenceId, s.target!), `Linked to ${s.ref}`)}>
                      <Link2 className="h-3 w-3 mr-1" />Link
                    </Button>
                  )}
            </div>
          ))}
        </div>
      )}
      {analysis.expiry && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium">Valid until {new Date(analysis.expiry.date).toLocaleDateString()}</span>
          <q className="italic text-muted-foreground">{analysis.expiry.quote}</q>
          {analysis.expiry.applied
            ? <span className="text-muted-foreground">Applied</span>
            : canEdit && (
              <Button size="sm" variant="outline" className="h-6 px-2" disabled={busy}
                onClick={() => act(() => evidenceApi.update(evidenceId, { valid_until: analysis.expiry!.date }), 'Validity date set')}>
                <CalendarCheck className="h-3 w-3 mr-1" />Set as valid until
              </Button>
            )}
        </div>
      )}
      <p className="text-[10px] text-muted-foreground">Proposals from the AI: nothing is applied until you click.</p>
    </div>
  );
}
