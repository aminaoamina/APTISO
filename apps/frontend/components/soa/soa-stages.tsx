'use client';

import { useMemo, useState } from 'react';
import {
  AlertTriangle, Check, CheckCircle2, ChevronDown, ChevronRight, FilePlus, FileText,
  Loader2, Printer, RefreshCw, Sparkles, X,
} from 'lucide-react';
import type { ControlStatus, SoaControlUpdate, SoaRow, SoaState } from '@/lib/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { NativeSelect } from '@/components/ui/native-select';
import { BlurField, InfoTip } from '@/components/risk-register/risk-stages';

export const STATUS_LABELS: Record<ControlStatus, string> = {
  IMPLEMENTED: 'Implemented',
  UNDERWAY: 'Implementation underway',
  PLANNED: 'Planned',
  REVIEW_NEEDED: 'Review needed',
};

const STATUS_COLORS: Record<ControlStatus, string> = {
  IMPLEMENTED: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  UNDERWAY: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  PLANNED: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
  REVIEW_NEEDED: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
};

const THEMES: [string, string][] = [
  ['5', 'A.5 Organizational controls'],
  ['6', 'A.6 People controls'],
  ['7', 'A.7 Physical controls'],
  ['8', 'A.8 Technological controls'],
];

const HELP = {
  applicable:
    'Whether the control is needed in your organization. Controls selected to treat risks in the Risk Register must be applicable. A control can be excluded only with a justification (clause 6.1.3 d).',
  justification:
    'Why the control is included or excluded — e.g. the risks it treats, a legal or contractual requirement, or the reason it does not apply (e.g. no in-house software development). Auditors check this for every control.',
  method:
    'How the control is (or will be) implemented — usually a reference to the policy or procedure and the key measures. The platform suggests a method you can adapt.',
  status:
    'Implemented: in place and working. Implementation underway: being implemented. Planned: not started yet. Review needed: exists but must be checked or improved. Anything other than Implemented goes into the Risk Treatment Plan.',
};

const person = (u: { first_name: string; last_name: string } | null) => (u ? `${u.first_name} ${u.last_name}` : '—');

// ─── Stage 1: setup ─────────────────────────────────────────────

export function SetupStage({
  state,
  onSave,
}: {
  state: SoaState;
  onSave: (answers: Record<string, boolean>) => Promise<void>;
}) {
  const [answers, setAnswers] = useState<Record<string, boolean>>(state.setup.answers ?? {});
  const [busy, setBusy] = useState(false);
  const canEdit = state.permissions.canEdit;
  const missing = state.setup.questions.filter(q => typeof answers[q.key] !== 'boolean').length;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">SoA setup</CardTitle>
        <CardDescription className="leading-relaxed max-w-3xl">
          Answer a few questions about your organization. The platform then suggests, for each of the 93 Annex A controls, whether it is applicable
          and why — based on these answers, the risks in your Risk Register and the requirements in your Register of Requirements.
          You can change every suggestion afterwards, and changing an answer later only updates the controls you have not edited yourself.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {state.setup.questions.map(q => (
          <fieldset key={q.key} className="rounded-lg border p-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="max-w-2xl">
                <legend className="text-sm font-medium">{q.question}</legend>
                <p className="text-xs text-muted-foreground mt-0.5">{q.help}</p>
                {q.excludes.length > 0 && (
                  <p className="text-xs text-muted-foreground mt-1">If &quot;No&quot;: {q.excludes.join(', ')} suggested as not applicable.</p>
                )}
              </div>
              <div className="flex gap-2">
                {[true, false].map(v => (
                  <label key={String(v)}
                    className={`cursor-pointer rounded-md border px-3 py-1.5 text-sm ${answers[q.key] === v ? 'border-[var(--brand-orange)] bg-[var(--brand-orange)]/10 font-medium' : 'border-border text-muted-foreground'}`}>
                    <input type="radio" className="sr-only" name={q.key} checked={answers[q.key] === v} disabled={!canEdit}
                      onChange={() => setAnswers(prev => ({ ...prev, [q.key]: v }))} />
                    {v ? 'Yes' : 'No'}
                  </label>
                ))}
              </div>
            </div>
          </fieldset>
        ))}
        {canEdit && (
          <div className="flex items-center justify-end gap-3 pt-2">
            {missing > 0 && <span className="text-xs text-muted-foreground">{missing} question(s) left</span>}
            <Button disabled={busy || missing > 0}
              onClick={async () => { setBusy(true); try { await onSave(answers); } finally { setBusy(false); } }}>
              {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
              {state.setup.completedAt ? 'Save answers and update suggestions' : 'Save and suggest the SoA'}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Stage 2: the Statement of Applicability ────────────────────

type Filter = 'all' | 'applicable' | 'not_applicable' | 'incomplete' | ControlStatus;

export function SoaTableStage({
  state,
  onUpdate,
  onRefresh,
}: {
  state: SoaState;
  onUpdate: (rowId: string, data: SoaControlUpdate) => Promise<void>;
  onRefresh: (overwrite: boolean) => Promise<void>;
}) {
  const [filter, setFilter] = useState<Filter>('all');
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const canEdit = state.permissions.canEdit;

  const isIncomplete = (r: SoaRow) =>
    r.applicable == null || !r.justification || (r.applicable && (!r.implementation_method || !r.status));

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return state.rows.filter(r => {
      if (q && !`${r.control.code} ${r.control.title}`.toLowerCase().includes(q)) return false;
      switch (filter) {
        case 'all': return true;
        case 'applicable': return r.applicable === true;
        case 'not_applicable': return r.applicable === false;
        case 'incomplete': return isIncomplete(r);
        default: return r.applicable === true && r.status === filter;
      }
    });
  }, [state.rows, filter, search]);

  const toggle = (id: string) => setExpanded(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const incompleteCount = state.rows.filter(isIncomplete).length;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Statement of Applicability</CardTitle>
        <CardDescription className="leading-relaxed max-w-3xl">
          On this screen you can see the 93 controls of ISO 27001 Annex A. For each one fill out: <strong>(mandatory)</strong> whether it is applicable — suggested from your risks and requirements;
          <strong> (mandatory)</strong> the justification — related risks and requirements are suggested; and <strong>(mandatory if applicable)</strong> the implementation method and status.
          Once every applicable control has an implementation method and status, click Next to go to the Risk Treatment Plan.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <Label htmlFor="soa-filter" className="text-xs">Show</Label>
            <NativeSelect id="soa-filter" value={filter} onChange={(e) => setFilter(e.target.value as Filter)}>
              <option value="all">All controls</option>
              <option value="applicable">Applicable</option>
              <option value="not_applicable">Non-applicable</option>
              <option value="IMPLEMENTED">Implemented</option>
              <option value="UNDERWAY">Implementation underway</option>
              <option value="PLANNED">Planned</option>
              <option value="REVIEW_NEEDED">Review needed</option>
              <option value="incomplete">Incomplete ({incompleteCount})</option>
            </NativeSelect>
          </div>
          <div className="flex-1 min-w-48">
            <Label htmlFor="soa-search" className="text-xs">Search</Label>
            <Input id="soa-search" placeholder="Code or name, e.g. A.8.13 or backup" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          {canEdit && (
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" disabled={busy}
                title="Updates the controls you have not edited yourself with the latest risks and requirements"
                onClick={async () => { setBusy(true); try { await onRefresh(false); } finally { setBusy(false); } }}>
                <RefreshCw className="h-4 w-4 mr-1" />Refresh suggestions
              </Button>
              <Button variant="ghost" size="sm" disabled={busy}
                onClick={async () => {
                  if (!window.confirm('Replace ALL applicability decisions and justifications with the suggestions, including the ones you edited?')) return;
                  setBusy(true); try { await onRefresh(true); } finally { setBusy(false); }
                }}>
                Reset all to suggestions
              </Button>
            </div>
          )}
        </div>

        {THEMES.map(([theme, title]) => {
          const rows = visible.filter(r => r.control.code.startsWith(`A.${theme}.`));
          if (rows.length === 0) return null;
          return (
            <div key={theme} className="space-y-1.5">
              <p className="text-sm font-semibold pt-2">{title}</p>
              {rows.map(r => (
                <SoaRowItem key={r.id} row={r} open={expanded.has(r.id)} onToggle={() => toggle(r.id)} canEdit={canEdit} onUpdate={onUpdate}
                  incomplete={isIncomplete(r)} />
              ))}
            </div>
          );
        })}
        {visible.length === 0 && <p className="text-sm text-muted-foreground py-6 text-center">No controls match this filter.</p>}
      </CardContent>
    </Card>
  );
}

function SoaRowItem({
  row: r,
  open,
  onToggle,
  canEdit,
  onUpdate,
  incomplete,
}: {
  row: SoaRow;
  open: boolean;
  onToggle: () => void;
  canEdit: boolean;
  onUpdate: (rowId: string, data: SoaControlUpdate) => Promise<void>;
  incomplete: boolean;
}) {
  const locked = r.treated_risks.length > 0;
  const sug = r.suggestion;
  const differs = !!sug && (sug.applicable !== r.applicable || sug.justification !== r.justification);

  return (
    <div className={`rounded-lg border ${incomplete ? 'border-amber-300 dark:border-amber-700' : 'border-border/60'}`}>
      <button type="button" onClick={onToggle} aria-expanded={open}
        className="flex w-full flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 text-left text-sm hover:bg-accent/30">
        {open ? <ChevronDown className="h-4 w-4 shrink-0" /> : <ChevronRight className="h-4 w-4 shrink-0" />}
        <span className="w-14 shrink-0 font-mono text-xs">{r.control.code}</span>
        <span className="flex-1 min-w-40">{r.control.title}</span>
        {r.treated_risks.length > 0 && <Badge variant="outline" className="text-xs">{r.treated_risks.map(t => t.ref).join(', ')}</Badge>}
        <Badge className={r.applicable == null ? 'bg-muted text-muted-foreground' : r.applicable ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' : 'bg-gray-200 text-gray-700 dark:bg-gray-800 dark:text-gray-300'}>
          {r.applicable == null ? 'Undecided' : r.applicable ? 'Applicable' : 'Not applicable'}
        </Badge>
        {r.applicable && r.status && <Badge className={STATUS_COLORS[r.status]}>{STATUS_LABELS[r.status]}</Badge>}
        {incomplete && <AlertTriangle className="h-4 w-4 text-amber-500" aria-label="Incomplete" />}
      </button>

      {open && (
        <div className="border-t border-border/60 p-3 space-y-3">
          <div className="flex flex-wrap items-center gap-4">
            <span className="flex items-center gap-1 text-xs font-medium">Applicable *<InfoTip text={HELP.applicable} /></span>
            {[true, false].map(v => (
              <label key={String(v)} className="flex items-center gap-1.5 text-sm">
                <input type="radio" name={`app-${r.id}`} checked={r.applicable === v} disabled={!canEdit || (!v && locked)}
                  onChange={() => onUpdate(r.id, { applicable: v })} />
                {v ? 'Yes' : 'No'}
              </label>
            ))}
            {locked && (
              <span className="text-xs text-muted-foreground">
                Must be applicable: treats {r.treated_risks.map(t => `${t.ref} (${t.label})`).join('; ')}
              </span>
            )}
          </div>

          <div>
            <Label className="flex items-center gap-1 text-xs">Justification *<InfoTip text={HELP.justification} /></Label>
            <BlurField multiline value={r.justification} disabled={!canEdit} onSave={(v) => onUpdate(r.id, { justification: v })} />
            {differs && sug && canEdit && (
              <div className="mt-1.5 flex flex-wrap items-start gap-2 rounded-md bg-muted/50 px-2.5 py-1.5 text-xs">
                <Sparkles className="h-3.5 w-3.5 mt-0.5 shrink-0 text-[var(--brand-orange)]" />
                <span className="flex-1">Suggested: <strong>{sug.applicable ? 'Applicable' : 'Not applicable'}</strong> — {sug.justification}</span>
                <Button size="sm" variant="ghost" className="h-6 px-2 text-xs"
                  disabled={!sug.applicable && locked}
                  onClick={() => onUpdate(r.id, { applicable: sug.applicable, justification: sug.justification })}>
                  Use suggestion
                </Button>
              </div>
            )}
            {sug && sug.sources.requirements.length > 0 && (
              <p className="mt-1 text-xs text-muted-foreground">Related requirements: {sug.sources.requirements.join('; ')}</p>
            )}
          </div>

          {r.applicable && (
            <div className="grid gap-3 sm:grid-cols-[2fr_1fr]">
              <div>
                <Label className="flex items-center gap-1 text-xs">Implementation method *<InfoTip text={HELP.method} /></Label>
                <BlurField multiline value={r.implementation_method} disabled={!canEdit}
                  onSave={(v) => onUpdate(r.id, { implementation_method: v })} />
              </div>
              <div>
                <Label htmlFor={`status-${r.id}`} className="flex items-center gap-1 text-xs">Status *<InfoTip text={HELP.status} /></Label>
                <NativeSelect id={`status-${r.id}`} value={r.status ?? ''} disabled={!canEdit}
                  onChange={(e) => onUpdate(r.id, { status: (e.target.value || null) as ControlStatus | null })}>
                  <option value="">Select status</option>
                  {(Object.keys(STATUS_LABELS) as ControlStatus[]).map(s => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
                </NativeSelect>
                {r.documents.length > 0 && (
                  <p className="mt-2 text-xs text-muted-foreground">Covered by: {r.documents.join(', ')}</p>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Stage 3: Risk Treatment Plan ───────────────────────────────

export function PlanStage({
  state,
  onUpdate,
  onConfirm,
}: {
  state: SoaState;
  onUpdate: (rowId: string, data: SoaControlUpdate) => Promise<void>;
  onConfirm: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const canEdit = state.permissions.canEdit;
  const plan = state.rows.filter(r => r.applicable && r.status && r.status !== 'IMPLEMENTED');

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Risk Treatment Plan</CardTitle>
        <CardDescription className="leading-relaxed max-w-3xl">
          Plan the implementation of every applicable control that is not implemented yet: who is responsible, the deadline, and the resources needed
          (budget, people, technology — leave empty if none). Resource requests go to top management for approval.
          Confirming the plan creates an implementation task for each responsible person — <strong>all created tasks need to be assigned</strong>.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {state.rtpConfirmedAt ? (
          <p className="flex items-center gap-2 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-800 dark:bg-green-900/20 dark:text-green-400">
            <CheckCircle2 className="h-4 w-4" />Plan confirmed on {new Date(state.rtpConfirmedAt).toLocaleString()}.
          </p>
        ) : plan.length > 0 && (
          <p className="text-sm text-muted-foreground">The plan is not confirmed{state.summary.planIncomplete > 0 ? ` — ${state.summary.planIncomplete} control(s) still need a responsible person and deadline` : ''}.</p>
        )}
        {plan.length === 0 && (
          <p className="text-sm text-muted-foreground py-6 text-center">All applicable controls are implemented — nothing to plan. Confirm the (empty) plan to continue.</p>
        )}

        {plan.map(r => (
          <div key={r.id} className="rounded-lg border border-border/60 p-3 space-y-2">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="font-mono text-xs">{r.control.code}</span>
              <span className="font-medium">{r.control.title}</span>
              {r.status && <Badge className={STATUS_COLORS[r.status]}>{STATUS_LABELS[r.status]}</Badge>}
            </div>
            <p className="text-xs text-muted-foreground">{r.implementation_method}</p>
            <div className="grid gap-3 sm:grid-cols-[1fr_auto_1.5fr]">
              <div>
                <Label htmlFor={`resp-${r.id}`} className="text-xs">Responsible person *</Label>
                <NativeSelect id={`resp-${r.id}`} value={r.responsible_id ?? ''} disabled={!canEdit}
                  onChange={(e) => onUpdate(r.id, { responsible_id: e.target.value || null })}>
                  <option value="">Not assigned</option>
                  {state.projectUsers.map(u => <option key={u.id} value={u.id}>{u.label}</option>)}
                </NativeSelect>
              </div>
              <div>
                <Label htmlFor={`deadline-${r.id}`} className="text-xs">Deadline *</Label>
                <Input id={`deadline-${r.id}`} type="date" value={r.deadline ? r.deadline.slice(0, 10) : ''} disabled={!canEdit}
                  onChange={(e) => onUpdate(r.id, { deadline: e.target.value || null })} />
              </div>
              <div>
                <Label className="text-xs">Resources needed</Label>
                <BlurField value={r.resources} disabled={!canEdit} placeholder="e.g. 2,000 EUR for a backup NAS (empty if none)"
                  onSave={(v) => onUpdate(r.id, { resources: v })} />
                {r.resources && <ResourceBadge row={r} />}
              </div>
            </div>
          </div>
        ))}

        {canEdit && (
          <div className="flex justify-end pt-2">
            <Button disabled={busy || !!state.rtpConfirmedAt}
              onClick={async () => { setBusy(true); try { await onConfirm(); } finally { setBusy(false); } }}>
              {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Check className="h-4 w-4 mr-2" />}
              {state.rtpConfirmedAt ? 'Plan confirmed' : 'Confirm plan and create tasks'}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ResourceBadge({ row }: { row: SoaRow }) {
  const d = row.resources_decision;
  const cls = d === 'APPROVED'
    ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
    : d === 'REJECTED' ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
      : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400';
  return (
    <p className="mt-1 text-xs">
      <Badge className={cls}>{d === 'APPROVED' ? 'Resources approved' : d === 'REJECTED' ? 'Resources rejected' : 'Awaiting top management'}</Badge>
      {row.resources_comment && <span className="ml-2 text-muted-foreground">“{row.resources_comment}”</span>}
    </p>
  );
}

// ─── Stage 4: resource approval ─────────────────────────────────

export function ResourcesStage({
  state,
  onDecide,
}: {
  state: SoaState;
  onDecide: (rowId: string, decision: 'APPROVED' | 'REJECTED', comment?: string) => Promise<void>;
}) {
  const requests = state.rows.filter(r => r.in_treatment_plan && r.resources);
  const canDecide = state.permissions.canEdit && state.permissions.canApproveResources;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Resource approval</CardTitle>
        <CardDescription className="leading-relaxed max-w-3xl">
          Top management approves the resources (budget, people, technology) needed to implement the Risk Treatment Plan.
          A rejected request sends the plan back for revision.
          {!state.permissions.canApproveResources && ' Only members with the Top management role (or the project lead on its behalf) can decide.'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {requests.length === 0 && <p className="text-sm text-muted-foreground py-6 text-center">No resources were requested in the plan.</p>}
        {requests.map(r => <ResourceRequest key={r.id} row={r} canDecide={canDecide} onDecide={onDecide} />)}
      </CardContent>
    </Card>
  );
}

function ResourceRequest({ row: r, canDecide, onDecide }: {
  row: SoaRow;
  canDecide: boolean;
  onDecide: (rowId: string, decision: 'APPROVED' | 'REJECTED', comment?: string) => Promise<void>;
}) {
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const decide = async (d: 'APPROVED' | 'REJECTED', c?: string) => {
    setBusy(true); try { await onDecide(r.id, d, c); setRejecting(false); setReason(''); } finally { setBusy(false); }
  };

  return (
    <div className="rounded-lg border border-border/60 p-3 space-y-2">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="font-mono text-xs">{r.control.code}</span>
        <span className="font-medium">{r.control.title}</span>
      </div>
      <p className="text-sm"><span className="text-muted-foreground">Resources:</span> {r.resources}</p>
      <p className="text-xs text-muted-foreground">Responsible: {person(r.responsible)} · Deadline: {r.deadline ? new Date(r.deadline).toLocaleDateString() : '—'}</p>
      <ResourceBadge row={r} />
      {r.resources_decider && r.resources_decided_at && (
        <p className="text-xs text-muted-foreground">Decided by {person(r.resources_decider)} on {new Date(r.resources_decided_at).toLocaleDateString()}</p>
      )}
      {canDecide && (rejecting ? (
        <div className="space-y-2">
          <Label htmlFor={`rej-${r.id}`} className="text-xs">Why are the resources rejected? *</Label>
          <Textarea id={`rej-${r.id}`} rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />
          <div className="flex gap-2">
            <Button size="sm" variant="destructive" disabled={busy || !reason.trim()} onClick={() => decide('REJECTED', reason)}>Reject</Button>
            <Button size="sm" variant="ghost" onClick={() => setRejecting(false)}>Cancel</Button>
          </div>
        </div>
      ) : (
        <div className="flex gap-2">
          <Button size="sm" variant="outline" disabled={busy || r.resources_decision === 'APPROVED'} onClick={() => decide('APPROVED')}>
            <Check className="h-4 w-4 mr-1" />Approve resources
          </Button>
          <Button size="sm" variant="outline" className="text-destructive" disabled={busy} onClick={() => setRejecting(true)}>
            <X className="h-4 w-4 mr-1" />Reject
          </Button>
        </div>
      ))}
    </div>
  );
}

// ─── Stage 5: risk owner approval ───────────────────────────────

export function OwnerApprovalStage({
  state,
  onDecide,
  documents,
  onCreateDoc,
  isCreatingDoc,
  documentHref,
}: {
  state: SoaState;
  onDecide: (decision: 'APPROVED' | 'REJECTED', comment?: string, onBehalfOf?: string) => Promise<void>;
  documents: { id: string; title: string }[];
  onCreateDoc: () => Promise<void>;
  isCreatingDoc: boolean;
  documentHref: (id: string) => string;
}) {
  const { permissions, summary } = state;
  const blocker = !state.rtpConfirmedAt
    ? 'Confirm the Risk Treatment Plan first.'
    : summary.resourcesPending > 0 || summary.resourcesRejected > 0
      ? 'All resource requests must be approved by top management first.'
      : null;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Risk owner approval</CardTitle>
          <CardDescription className="leading-relaxed max-w-3xl">
            Each risk owner approves the Risk Treatment Plan and accepts the residual risks (clause 6.1.3 f). Rejecting sends the plan back for revision.
            Any later change to the SoA or the plan requires a new approval.
            {permissions.isLead && ' As project lead you can record a decision on behalf of a risk owner; your name is kept as the decision maker.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {blocker && <p className="text-sm text-amber-700 dark:text-amber-400">{blocker}</p>}
          {state.approvals.map(a => (
            <ApprovalRow key={a.user.id} approval={a} state={state} blocked={!!blocker} onDecide={onDecide} />
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><FileText className="h-4 w-4" />Statement of Applicability document</CardTitle>
          <CardDescription>
            One document containing the Statement of Applicability, the Risk Treatment Plan and the risk owners&apos; approvals. Refresh it after changes.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {permissions.canEdit && (
            <Button onClick={onCreateDoc} disabled={isCreatingDoc}>
              {isCreatingDoc ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FilePlus className="h-4 w-4 mr-2" />}
              {documents.length > 0 ? 'Refresh document' : 'Generate document'}
            </Button>
          )}
          {documents.map(d => (
            <a key={d.id} href={documentHref(d.id)} className="flex items-center gap-2 text-sm text-[var(--brand-orange)] hover:underline">
              <Printer className="h-4 w-4" />{d.title}
            </a>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function ApprovalRow({ approval: a, state, blocked, onDecide }: {
  approval: SoaState['approvals'][number];
  state: SoaState;
  blocked: boolean;
  onDecide: (decision: 'APPROVED' | 'REJECTED', comment?: string, onBehalfOf?: string) => Promise<void>;
}) {
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const { permissions } = state;
  const isMe = a.user.id === permissions.userId;
  const mayDecide = permissions.canEdit && (isMe || permissions.isLead) && !blocked;
  const onBehalf = isMe ? undefined : a.user.id;
  const decide = async (d: 'APPROVED' | 'REJECTED', c?: string) => {
    setBusy(true); try { await onDecide(d, c, onBehalf); setRejecting(false); setReason(''); } finally { setBusy(false); }
  };
  const cls = a.decision === 'APPROVED'
    ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
    : a.decision === 'REJECTED' ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
      : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400';

  return (
    <div className="rounded-lg border border-border/60 p-3 space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium">{person(a.user)}{isMe && ' (you)'}</p>
        <Badge className={cls}>{a.decision === 'APPROVED' ? 'Approved' : a.decision === 'REJECTED' ? 'Rejected' : 'Pending'}</Badge>
      </div>
      {a.decided_at && (
        <p className="text-xs text-muted-foreground">
          By {person(a.decider)} on {new Date(a.decided_at).toLocaleDateString()}{a.comment && ` — “${a.comment}”`}
        </p>
      )}
      {mayDecide && (rejecting ? (
        <div className="space-y-2">
          <Label htmlFor={`own-${a.user.id}`} className="text-xs">What must be improved in the plan? *</Label>
          <Textarea id={`own-${a.user.id}`} rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />
          <div className="flex gap-2">
            <Button size="sm" variant="destructive" disabled={busy || !reason.trim()} onClick={() => decide('REJECTED', reason)}>Send back</Button>
            <Button size="sm" variant="ghost" onClick={() => setRejecting(false)}>Cancel</Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" disabled={busy || a.decision === 'APPROVED'} onClick={() => decide('APPROVED')}>
            <Check className="h-4 w-4 mr-1" />Approve plan and residual risks{!isMe && ' (on behalf)'}
          </Button>
          <Button size="sm" variant="outline" className="text-destructive" disabled={busy} onClick={() => setRejecting(true)}>
            <X className="h-4 w-4 mr-1" />Reject
          </Button>
        </div>
      ))}
    </div>
  );
}
