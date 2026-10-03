'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, Check, ChevronLeft, ChevronRight } from 'lucide-react';
import { soaApi, RiskRegisterCompletion, SoaControlUpdate, SoaState } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { toast } from 'sonner';
import { getErrorMessage } from '@/lib/utils';
import { OwnerApprovalStage, PlanStage, ResourcesStage, SetupStage, SoaTableStage } from './soa-stages';

// Conformio's five SoA stages.
const STAGES = ['SoA setup', 'Initial (SoA)', 'Risk Treatment Plan', 'Resource approval', 'Risk owner approval'];
const LAST = STAGES.length - 1;

export default function SoaStep({
  stepId,
  orgId,
  projectId,
  onCompletionChange,
}: {
  stepId: string;
  orgId: string;
  projectId: string;
  /** Lets the step page lock "Finish" until the SoA is complete. */
  onCompletionChange?: (completion: RiskRegisterCompletion) => void;
}) {
  const [state, setState] = useState<SoaState | null>(null);
  const [documents, setDocuments] = useState<{ id: string; title: string }[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreatingDoc, setIsCreatingDoc] = useState(false);
  const [stage, setStage] = useState(0);
  const resumed = useRef(false);

  const load = useCallback(async () => {
    try {
      const [s, docs] = await Promise.all([soaApi.get(stepId), soaApi.getDocuments(stepId)]);
      setState(s);
      setDocuments(docs);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to load the Statement of Applicability'));
    } finally {
      setIsLoading(false);
    }
  }, [stepId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!state) return;
    onCompletionChange?.(state.completion);
    // Reopen at the first stage that still needs work.
    if (!resumed.current) {
      resumed.current = true;
      const s = state.summary;
      if (!state.setup.completedAt) setStage(0);
      else if (s.undecided + s.unjustified + s.applicableIncomplete > 0) setStage(1);
      else if (!state.rtpConfirmedAt) setStage(2);
      else if (s.resourcesPending + s.resourcesRejected > 0) setStage(3);
      else setStage(4);
    }
  }, [state, onCompletionChange]);

  // Every call returns the full state; keep the error handling in one place.
  const run = async (fn: () => Promise<SoaState>, success?: string) => {
    try {
      setState(await fn());
      if (success) toast.success(success);
      return true;
    } catch (err) {
      toast.error(getErrorMessage(err, 'Action failed'));
      return false;
    }
  };

  if (isLoading) return <div className="flex justify-center py-16"><Spinner className="h-6 w-6" /></div>;
  if (!state) return <p className="text-sm text-muted-foreground">Unable to load the Statement of Applicability.</p>;

  const s = state.summary;
  const canEdit = state.permissions.canEdit;
  const setupDone = !!state.setup.completedAt;
  const soaComplete = setupDone && s.undecided + s.unjustified + s.applicableIncomplete === 0;
  // Conformio: Next from the SoA table only once every applicable control has a method (and here, a status).
  const canNext = !canEdit || (stage === 0 ? setupDone : stage === 1 ? soaComplete : stage === 2 ? !!state.rtpConfirmedAt : true);
  const nextHint =
    stage === 0 ? 'Save the setup answers first'
      : stage === 1 ? `Complete every control first (${s.undecided + s.unjustified + s.applicableIncomplete} incomplete)`
        : stage === 2 ? 'Confirm the plan first' : undefined;

  const createDoc = async () => {
    setIsCreatingDoc(true);
    try {
      setDocuments(await soaApi.createDocument(stepId));
      setState(await soaApi.get(stepId));
      toast.success('Document generated');
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to generate the document'));
    } finally {
      setIsCreatingDoc(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Register information (Conformio: applicable controls / not yet implemented controls) */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        {([
          ['Applicable controls', setupDone ? s.applicable : '—'],
          ['Not yet implemented', setupDone ? s.planned : '—'],
          ['Not applicable', setupDone ? s.notApplicable : '—'],
          ['Incomplete controls', setupDone ? s.undecided + s.unjustified + s.applicableIncomplete : '—'],
          ['Owner approvals', `${state.approvals.filter(a => a.decision === 'APPROVED').length}/${state.approvals.length}`],
        ] as const).map(([label, value]) => (
          <div key={label} className="rounded-lg border border-border/60 bg-card px-3 py-2">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="text-lg font-semibold tabular-nums">{value}</p>
          </div>
        ))}
      </div>

      {!state.riskRegister.completed && (
        <p className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-900/20 dark:text-amber-300">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
          The Risk Register step is not finished. You can prepare the SoA, but applicability is suggested from the risk treatment:
          finish the Risk Register, then use &quot;Refresh suggestions&quot;. The SoA can only be finished after the Risk Register.
        </p>
      )}
      {!canEdit && (
        <p className="rounded-lg border border-border/60 bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
          You have read-only access to the Statement of Applicability (auditor).
        </p>
      )}

      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-wrap gap-2">
            {STAGES.map((t, i) => {
              const reachable = i <= stage || !canEdit || (i === 1 && setupDone);
              return (
                <button key={t} type="button" onClick={() => reachable && setStage(i)} disabled={!reachable}
                  className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                    i === stage ? 'bg-[var(--brand-orange)] text-white'
                      : i < stage ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                        : 'bg-muted text-muted-foreground'
                  }`}>
                  {i < stage && <Check className="h-3 w-3" />}{i + 1}. {t}
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {stage === 0 && (
        <SetupStage state={state}
          onSave={async (answers) => {
            if (await run(() => soaApi.saveSetup(stepId, answers), 'Setup saved — the SoA has been suggested')) setStage(1);
          }} />
      )}
      {stage === 1 && (
        <SoaTableStage projectId={projectId} state={state}
          onUpdate={async (id, data: SoaControlUpdate) => { await run(() => soaApi.updateControl(id, data)); }}
          onRefresh={async (overwrite) => { await run(() => soaApi.refreshSuggestions(stepId, overwrite), 'Suggestions updated'); }} />
      )}
      {stage === 2 && (
        <PlanStage state={state}
          onUpdate={async (id, data) => { await run(() => soaApi.updateControl(id, data)); }}
          onConfirm={async () => { await run(() => soaApi.confirmPlan(stepId), 'Plan confirmed — implementation tasks created'); }} />
      )}
      {stage === 3 && (
        <ResourcesStage state={state}
          onDecide={async (id, d, c) => { await run(() => soaApi.decideResources(id, d, c), d === 'APPROVED' ? 'Resources approved' : 'Resources rejected — plan sent back'); }} />
      )}
      {stage === 4 && (
        <OwnerApprovalStage state={state}
          onDecide={async (d, c, onBehalfOf) => {
            await run(() => soaApi.ownerApproval(stepId, { decision: d, comment: c?.trim() || undefined, on_behalf_of: onBehalfOf }),
              d === 'APPROVED' ? 'Plan and residual risks approved' : 'Plan sent back for revision');
          }}
          documents={documents}
          onCreateDoc={createDoc}
          isCreatingDoc={isCreatingDoc}
          documentHref={(id) => `/dashboard/organizations/${orgId}/projects/${projectId}/documents/${id}`} />
      )}

      <div className="flex items-center justify-between">
        <Button variant="outline" onClick={() => setStage(st => Math.max(0, st - 1))} disabled={stage === 0}>
          <ChevronLeft className="h-4 w-4 mr-1" />Previous
        </Button>
        {stage < LAST && (
          <Button onClick={() => setStage(st => Math.min(LAST, st + 1))} disabled={!canNext} title={!canNext ? nextHint : undefined}>
            {stage === 1 ? 'Next step - Risk Treatment Plan' : 'Next'}<ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        )}
      </div>
    </div>
  );
}
