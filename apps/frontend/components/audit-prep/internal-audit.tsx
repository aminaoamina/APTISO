'use client';

import { useCallback, useMemo, useState } from 'react';
import { Check, ChevronDown, ChevronRight, Play, Plus, Send, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { auditsApi, Audit, AuditItem, AuditResult, AuditsState } from '@/lib/audit-prep-api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { NativeSelect } from '@/components/ui/native-select';
import { Spinner } from '@/components/ui/spinner';
import {
  BlurField, Counters, DocumentCard, PersonSelect, ReadOnlyNotice, StepComponentProps, docHref, fmtDate, nameOf, useRegister,
} from './shared';

export const RESULTS: Record<AuditResult, [string, string]> = {
  CONFORMING: ['Conforming', 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'],
  MINOR_NONCONFORMITY: ['Minor nonconformity', 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400'],
  MAJOR_NONCONFORMITY: ['Major nonconformity', 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'],
  OBSERVATION: ['Observation', 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'],
  NOT_AUDITED: ['Not audited', 'bg-muted text-muted-foreground'],
};

const STATUS: Record<Audit['status'], string> = { PLANNED: 'Planned', IN_PROGRESS: 'In progress', REPORTED: 'Reported — awaiting approval', APPROVED: 'Report approved' };

type Run = (fn: () => Promise<AuditsState>, s?: string) => Promise<boolean>;

/** Phase 4 step 6: internal audit (clauses 9.2 and 10.1). */
export default function InternalAudit({ stepId, orgId, projectId, onCompletionChange }: StepComponentProps) {
  const load = useCallback(() => auditsApi.get(stepId), [stepId]);
  const { state, loading, run } = useRegister<AuditsState>(load, onCompletionChange);
  const [adding, setAdding] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const [f, setF] = useState({ title: `Internal audit ${new Date().getFullYear()}`, start_date: '', end_date: '', lead_auditor_id: null as string | null, auditees: '' });

  if (loading) return <div className="flex justify-center py-16"><Spinner className="h-6 w-6" /></div>;
  if (!state) return <p className="text-sm text-muted-foreground">Unable to load the internal audits.</p>;
  const { permissions, counters } = state;

  return (
    <div className="space-y-4">
      <Counters items={[['Planned audits', counters.planned], ['Audits in progress', counters.inProgress], ['Approved reports', counters.approved], ['Audits', state.audits.length]]} />
      <ReadOnlyNotice show={!permissions.canEdit} />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Scheduled audits</CardTitle>
          <CardDescription className="max-w-3xl leading-relaxed">
            Schedule the internal audit and choose an objective, impartial lead auditor — auditors must not audit their own work.
            The checklist covers every ISO 27001 requirement (clauses 4 to 10) and every control applicable in your Statement of Applicability.
            Nonconformities found are added to the <Link className="text-[var(--brand-orange)] hover:underline" href={`/dashboard/organizations/${orgId}/projects/${projectId}/registers`}>Nonconformity register</Link>.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {permissions.canEdit && !adding && <Button size="sm" onClick={() => setAdding(true)}><Plus className="h-4 w-4 mr-1" />Schedule new audit</Button>}
          {adding && (
            <div className="rounded-lg border p-3 space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="sm:col-span-2"><Label htmlFor="au-title" className="text-xs">Title *</Label>
                  <Input id="au-title" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></div>
                <div><Label htmlFor="au-start" className="text-xs">Start date *</Label>
                  <Input id="au-start" type="date" value={f.start_date} onChange={(e) => setF({ ...f, start_date: e.target.value })} /></div>
                <div><Label htmlFor="au-end" className="text-xs">End date *</Label>
                  <Input id="au-end" type="date" value={f.end_date} onChange={(e) => setF({ ...f, end_date: e.target.value })} /></div>
                <div><Label className="text-xs">Lead auditor *</Label>
                  <PersonSelect members={state.members} value={f.lead_auditor_id} placeholder="Select the auditor" onChange={(v) => setF({ ...f, lead_auditor_id: v })} /></div>
                <div><Label htmlFor="au-who" className="text-xs">Auditees</Label>
                  <Input id="au-who" value={f.auditees} onChange={(e) => setF({ ...f, auditees: e.target.value })} placeholder="People or departments interviewed" /></div>
              </div>
              <p className="text-xs text-muted-foreground">Scope and criteria default to the whole ISMS and ISO/IEC 27001:2022; you can edit them after scheduling.</p>
              <div className="flex gap-2">
                <Button size="sm" disabled={!f.title.trim() || !f.start_date || !f.end_date || !f.lead_auditor_id}
                  onClick={async () => { if (await run(() => auditsApi.create(stepId, { ...f, auditees: f.auditees || undefined }), 'Audit scheduled — the lead auditor got a task')) setAdding(false); }}>
                  Schedule
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setAdding(false)}>Cancel</Button>
              </div>
            </div>
          )}
          {state.audits.length === 0 && !adding && (
            <p className="text-sm text-muted-foreground py-6 text-center">There are no scheduled audits. To add an entry, click the button above.</p>
          )}
          {state.audits.map(a => (
            <AuditPanel key={a.id} audit={a} state={state} stepId={stepId} run={run} open={open === a.id} onToggle={() => setOpen(open === a.id ? null : a.id)} />
          ))}
        </CardContent>
      </Card>

      <DocumentCard title="Internal Audit Report" documents={state.documents} canEdit={permissions.canEdit}
        description="Scope, criteria, findings and conclusion of the reported audits (clause 9.2.2)."
        onGenerate={() => run(() => auditsApi.document(stepId), 'Report generated')} href={docHref(orgId, projectId)} />
    </div>
  );
}

function AuditPanel({ audit: a, state, stepId, run, open, onToggle }: {
  audit: Audit; state: AuditsState; stepId: string; run: Run; open: boolean; onToggle: () => void;
}) {
  const { permissions, members } = state;
  const [filter, setFilter] = useState<'all' | 'open' | 'findings'>('all');
  const [conclusion, setConclusion] = useState(a.conclusion ?? '');
  const editable = permissions.canEdit && a.status !== 'APPROVED';
  const done = a.items.filter(i => i.result).length;
  const items = useMemo(() => a.items.filter(i =>
    filter === 'all' ? true : filter === 'open' ? !i.result : i.result && i.result !== 'CONFORMING' && i.result !== 'NOT_AUDITED'), [a.items, filter]);

  return (
    <div className="rounded-lg border border-border/60">
      <button type="button" onClick={onToggle} aria-expanded={open} className="flex w-full flex-wrap items-center gap-2 px-3 py-2 text-left text-sm hover:bg-accent/30">
        {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        <span className="flex-1 min-w-40 font-medium">{a.title}</span>
        <span className="text-xs text-muted-foreground">{fmtDate(a.start_date)} – {fmtDate(a.end_date)} · {nameOf(members, a.lead_auditor_id)} · {done}/{a.items.length}</span>
        <Badge variant="outline">{STATUS[a.status]}</Badge>
      </button>
      {open && (
        <div className="border-t border-border/60 p-3 space-y-3 text-sm">
          <div className="grid gap-3 sm:grid-cols-2">
            <div><Label className="text-xs">Scope</Label>
              <BlurField multiline value={a.scope} disabled={!editable} onSave={(v) => run(() => auditsApi.update(stepId, a.id, { scope: v }))} /></div>
            <div><Label className="text-xs">Criteria</Label>
              <BlurField multiline value={a.criteria} disabled={!editable} onSave={(v) => run(() => auditsApi.update(stepId, a.id, { criteria: v }))} /></div>
          </div>

          {a.status === 'PLANNED' && permissions.canEdit && (
            <div className="flex gap-2">
              <Button size="sm" onClick={() => run(() => auditsApi.start(stepId, a.id), 'Audit started')}><Play className="h-4 w-4 mr-1" />Start audit</Button>
              <Button size="sm" variant="ghost" className="text-destructive" onClick={() => window.confirm('Delete this audit?') && run(() => auditsApi.remove(stepId, a.id), 'Audit deleted')}>
                <Trash2 className="h-4 w-4 mr-1" />Delete
              </Button>
            </div>
          )}

          {a.status !== 'PLANNED' && (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-xs font-medium flex-1">Audit checklist — {done} of {a.items.length} assessed</p>
                <NativeSelect aria-label="Filter checklist" className="w-44" value={filter} onChange={(e) => setFilter(e.target.value as typeof filter)}>
                  <option value="all">All items</option><option value="open">Not assessed yet</option><option value="findings">Findings only</option>
                </NativeSelect>
              </div>
              <div className="space-y-1.5 max-h-[32rem] overflow-y-auto pr-1">
                {items.map(i => <ChecklistItem key={i.id} item={i} editable={editable} onSave={(d) => run(() => auditsApi.updateItem(stepId, a.id, i.id, d))} />)}
              </div>
            </>
          )}

          {(a.status === 'IN_PROGRESS' || a.status === 'REPORTED' || a.status === 'APPROVED') && (
            <div className="space-y-2 border-t border-border/60 pt-3">
              <Label htmlFor={`concl-${a.id}`} className="text-xs">Audit conclusion *</Label>
              <Textarea id={`concl-${a.id}`} rows={3} value={conclusion} disabled={a.status !== 'IN_PROGRESS' || !permissions.canEdit}
                onChange={(e) => setConclusion(e.target.value)} placeholder="Overall conformity and effectiveness of the ISMS, main findings" />
              <div className="flex flex-wrap items-center gap-2">
                {a.status === 'IN_PROGRESS' && permissions.canEdit && (
                  <Button size="sm" disabled={!conclusion.trim() || done < a.items.length}
                    title={done < a.items.length ? 'Assess every checklist item first' : undefined}
                    onClick={() => run(() => auditsApi.report(stepId, a.id, conclusion), 'Audit reported to management')}>
                    <Send className="h-4 w-4 mr-1" />Report audit
                  </Button>
                )}
                {a.status === 'REPORTED' && permissions.canDecide && permissions.canEdit && (
                  <Button size="sm" onClick={() => run(() => auditsApi.approve(stepId, a.id), 'Audit report approved')}><Check className="h-4 w-4 mr-1" />Approve report</Button>
                )}
                {a.status === 'REPORTED' && !permissions.canDecide && <span className="text-xs text-muted-foreground">Awaiting approval by top management.</span>}
                {a.status === 'APPROVED' && <span className="text-xs text-muted-foreground">Approved by {nameOf(members, a.approved_by)} on {fmtDate(a.approved_at)}</span>}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ChecklistItem({ item: i, editable, onSave }: { item: AuditItem; editable: boolean; onSave: (d: Record<string, unknown>) => Promise<boolean> }) {
  const [open, setOpen] = useState(false);
  const [evidence, setEvidence] = useState(i.evidence ?? '');
  // A finding picked before its evidence is typed waits here and is saved with the evidence.
  const [pending, setPending] = useState<string | null>(null);
  const needsEvidence = (r: string) => r === 'MINOR_NONCONFORMITY' || r === 'MAJOR_NONCONFORMITY' || r === 'OBSERVATION';
  const saveEvidence = async () => {
    if (pending && evidence.trim()) {
      if (await onSave({ result: pending, evidence })) setPending(null);
    } else if (i.result && evidence !== (i.evidence ?? '')) {
      await onSave({ evidence });
    }
  };

  return (
    <div className="rounded-md border px-2.5 py-1.5">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => setOpen(o => !o)} aria-expanded={open} className="flex flex-1 min-w-48 items-center gap-2 text-left">
          {open ? <ChevronDown className="h-3.5 w-3.5 shrink-0" /> : <ChevronRight className="h-3.5 w-3.5 shrink-0" />}
          <span className="w-12 shrink-0 font-mono text-xs">{i.ref}</span>
          <span>{i.requirement}</span>
        </button>
        {i.nonconformity && <Badge variant="outline" className="text-xs">NC-{String(i.nonconformity.number).padStart(3, '0')}</Badge>}
        <NativeSelect aria-label={`Result for ${i.ref}`} className="w-48" value={pending ?? i.result ?? ''} disabled={!editable}
          onChange={(e) => {
            const r = e.target.value;
            setPending(null);
            if (!r) return onSave({ result: null });
            if (needsEvidence(r) && !evidence.trim()) { setPending(r); setOpen(true); return; }
            onSave({ result: r, evidence });
          }}>
          <option value="">Not assessed</option>
          {Object.entries(RESULTS).map(([k, [l]]) => <option key={k} value={k}>{l}</option>)}
        </NativeSelect>
      </div>
      {open && (
        <div className="mt-2 space-y-2 pl-6">
          <p className="text-xs text-muted-foreground">{i.question}</p>
          <Label htmlFor={`ev-${i.id}`} className="text-xs">Evidence (documents, records, interviews){' '}<span className="text-muted-foreground">— required for nonconformities and observations</span></Label>
          <Textarea id={`ev-${i.id}`} rows={2} value={evidence} disabled={!editable} onChange={(e) => setEvidence(e.target.value)}
            onBlur={saveEvidence} />
          {pending && <p className="text-xs text-amber-700 dark:text-amber-400">Describe the evidence to record this finding.</p>}
          {i.result && !pending && <Badge className={RESULTS[i.result][1]}>{RESULTS[i.result][0]}</Badge>}
        </div>
      )}
    </div>
  );
}
