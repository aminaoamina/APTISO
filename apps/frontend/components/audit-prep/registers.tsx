'use client';

import { useCallback, useState } from 'react';
import { ChevronDown, ChevronRight, Loader2, Plus, Trash2 } from 'lucide-react';
import {
  registersApi, ActionStatus, FindingSource, Incident, IncidentStatus, Member, Nonconformity, NcStatus, RegistersState, Severity,
} from '@/lib/audit-prep-api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { NativeSelect } from '@/components/ui/native-select';
import { Spinner } from '@/components/ui/spinner';
import { BlurField, Counters, PersonSelect, ReadOnlyNotice, fmtDate, nameOf, useRegister } from './shared';

const NC_STATUS: Record<NcStatus, [string, string]> = {
  UNASSIGNED: ['Unassigned', 'bg-gray-200 text-gray-800 dark:bg-gray-800 dark:text-gray-300'],
  ASSIGNED: ['Assigned', 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'],
  ACTIONS_DEFINED: ['Corrections and corrective actions defined', 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400'],
  RESOLVED: ['Resolved', 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'],
  NOT_RELEVANT: ['Not relevant', 'bg-muted text-muted-foreground'],
};

const SOURCES: Record<FindingSource, string> = {
  INTERNAL_AUDIT: 'Internal audit',
  EXTERNAL_AUDIT: 'External audit',
  INCIDENT: 'Incident',
  MANAGEMENT_REVIEW: 'Management review',
  EMPLOYEE: 'Employee report',
  SUPPLIER: 'Supplier / partner',
  OTHER: 'Other',
};

const INCIDENT_STATUS: Record<IncidentStatus, string> = { REPORTED: 'Reported', ASSESSED: 'Assessed', RESOLVED: 'Resolved', CLOSED: 'Closed' };
const ACTION_STATUS: Record<ActionStatus, string> = { PLANNED: 'Planned', IN_PROGRESS: 'In progress', DONE: 'Done' };
const ncRef = (n: number) => `NC-${String(n).padStart(3, '0')}`;
const incRef = (n: number) => `INC-${String(n).padStart(3, '0')}`;

/** Nonconformity (with corrective actions) and incident registers — clause 10.2, A.5.24-A.5.28. */
export function ImprovementRegisters({ projectId }: { projectId: string }) {
  const load = useCallback(() => registersApi.get(projectId), [projectId]);
  const { state, loading, run } = useRegister<RegistersState>(load);
  const [tab, setTab] = useState<'nc' | 'incidents'>('nc');

  if (loading) return <div className="flex justify-center py-16"><Spinner className="h-6 w-6" /></div>;
  if (!state) return <p className="text-sm text-muted-foreground">Unable to load the registers.</p>;
  const s = state.summary;

  return (
    <div className="space-y-4">
      <Counters items={[
        ['Open nonconformities', s.nonconformities.open],
        ['Resolved nonconformities', s.nonconformities.resolved],
        ['Corrective actions done', `${s.correctiveActions.done}/${s.correctiveActions.total}`],
        ['Open incidents', s.incidents.open],
      ]} />
      <ReadOnlyNotice show={!state.permissions.canEdit} />
      <div className="flex gap-2" role="tablist">
        {([['nc', `Nonconformities (${s.nonconformities.total})`], ['incidents', `Incidents (${s.incidents.total})`]] as const).map(([k, label]) => (
          <Button key={k} role="tab" aria-selected={tab === k} variant={tab === k ? 'default' : 'outline'} size="sm" onClick={() => setTab(k)}>{label}</Button>
        ))}
      </div>
      {tab === 'nc'
        ? <NonconformityRegister state={state} projectId={projectId} run={run} />
        : <IncidentRegister state={state} projectId={projectId} run={run} />}
    </div>
  );
}

type Run = (fn: () => Promise<RegistersState>, success?: string) => Promise<boolean>;

// ─── Nonconformities ────────────────────────────────────────────

function NonconformityRegister({ state, projectId, run }: { state: RegistersState; projectId: string; run: Run }) {
  const [adding, setAdding] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const canEdit = state.permissions.canEdit;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Nonconformity register</CardTitle>
        <CardDescription className="max-w-3xl leading-relaxed">
          Here you should enter all nonconformities, i.e., when your employee, supplier or partner does not comply with your policies, procedures, contracts or other requirements.
          For each one record the correction, the root cause and the corrective actions; it is resolved once the actions are done and their effectiveness is reviewed (clause 10.2).
          Findings of internal audits are added automatically.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {canEdit && !adding && <Button size="sm" onClick={() => setAdding(true)}><Plus className="h-4 w-4 mr-1" />Add new</Button>}
        {adding && <NewNonconformity members={state.members} onCancel={() => setAdding(false)}
          onSave={async (d) => { if (await run(() => registersApi.createNc(projectId, d), 'Nonconformity recorded')) setAdding(false); }} />}
        {state.nonconformities.length === 0 && !adding && (
          <p className="text-sm text-muted-foreground py-6 text-center">There are no added nonconformities. To add an entry, click the button above.</p>
        )}
        {state.nonconformities.map(nc => (
          <NonconformityRow key={nc.id} nc={nc} members={state.members} canEdit={canEdit} projectId={projectId} run={run}
            open={open === nc.id} onToggle={() => setOpen(open === nc.id ? null : nc.id)} />
        ))}
      </CardContent>
    </Card>
  );
}

function NewNonconformity({ members, onSave, onCancel }: {
  members: Member[];
  onSave: (d: Record<string, unknown>) => Promise<void>;
  onCancel: () => void;
}) {
  const [f, setF] = useState({ title: '', description: '', source: 'OTHER' as FindingSource, detected_on: new Date().toISOString().slice(0, 10), responsible_id: null as string | null });
  const [busy, setBusy] = useState(false);
  return (
    <div className="rounded-lg border p-3 space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2"><Label htmlFor="nc-title" className="text-xs">Title *</Label>
          <Input id="nc-title" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="What requirement is not fulfilled?" /></div>
        <div className="sm:col-span-2"><Label htmlFor="nc-desc" className="text-xs">Description *</Label>
          <Textarea id="nc-desc" rows={2} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></div>
        <div><Label htmlFor="nc-source" className="text-xs">Source</Label>
          <NativeSelect id="nc-source" value={f.source} onChange={(e) => setF({ ...f, source: e.target.value as FindingSource })}>
            {Object.entries(SOURCES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </NativeSelect></div>
        <div><Label htmlFor="nc-date" className="text-xs">Date detected *</Label>
          <Input id="nc-date" type="date" value={f.detected_on} onChange={(e) => setF({ ...f, detected_on: e.target.value })} /></div>
        <div><Label className="text-xs">Responsible person</Label>
          <PersonSelect members={members} value={f.responsible_id} onChange={(v) => setF({ ...f, responsible_id: v })} /></div>
      </div>
      <div className="flex gap-2">
        <Button size="sm" disabled={busy || !f.title.trim() || !f.description.trim()}
          onClick={async () => { setBusy(true); try { await onSave({ ...f, responsible_id: f.responsible_id ?? undefined }); } finally { setBusy(false); } }}>
          {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Save
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancel}>Cancel</Button>
      </div>
    </div>
  );
}

function NonconformityRow({ nc, members, canEdit, projectId, run, open, onToggle }: {
  nc: Nonconformity; members: Member[]; canEdit: boolean; projectId: string; run: Run; open: boolean; onToggle: () => void;
}) {
  const [newAction, setNewAction] = useState({ description: '', responsible_id: null as string | null, due_date: '' });
  const [review, setReview] = useState('');
  const [reason, setReason] = useState('');
  const closed = nc.status === 'RESOLVED' || nc.status === 'NOT_RELEVANT';
  const editable = canEdit && !closed;
  const [label, cls] = NC_STATUS[nc.status];
  const allDone = nc.actions.length > 0 && nc.actions.every(a => a.status === 'DONE');

  return (
    <div className="rounded-lg border border-border/60">
      <button type="button" onClick={onToggle} aria-expanded={open} className="flex w-full flex-wrap items-center gap-2 px-3 py-2 text-left text-sm hover:bg-accent/30">
        {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        <span className="font-mono text-xs">{ncRef(nc.number)}</span>
        <span className="flex-1 min-w-40 font-medium">{nc.title}</span>
        <span className="text-xs text-muted-foreground">{fmtDate(nc.detected_on)} · {nameOf(members, nc.responsible_id)}</span>
        <Badge className={cls}>{label}</Badge>
      </button>
      {open && (
        <div className="border-t border-border/60 p-3 space-y-3 text-sm">
          <p className="text-muted-foreground">
            {SOURCES[nc.source]}{nc.audit_item && ` — ${nc.audit_item.audit.title}, ${nc.audit_item.ref}`}{nc.incident && ` — ${incRef(nc.incident.number)} ${nc.incident.title}`}
          </p>
          <p>{nc.description}</p>
          <div className="grid gap-3 sm:grid-cols-3">
            <div><Label className="text-xs">Responsible person</Label>
              <PersonSelect members={members} value={nc.responsible_id} disabled={!editable}
                onChange={(v) => run(() => registersApi.updateNc(projectId, nc.id, { responsible_id: v }))} /></div>
            <div className="sm:col-span-2"><Label className="text-xs">Correction (immediate fix)</Label>
              <BlurField multiline value={nc.correction} disabled={!editable} onSave={(v) => run(() => registersApi.updateNc(projectId, nc.id, { correction: v }))} /></div>
            <div className="sm:col-span-3"><Label className="text-xs">Root cause</Label>
              <BlurField multiline value={nc.root_cause} disabled={!editable} onSave={(v) => run(() => registersApi.updateNc(projectId, nc.id, { root_cause: v }))} /></div>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-medium">Corrective actions</p>
            {nc.actions.length === 0 && <p className="text-xs text-muted-foreground">No corrective action yet.</p>}
            {nc.actions.map(a => (
              <div key={a.id} className="flex flex-wrap items-center gap-2 rounded-md border px-2.5 py-1.5">
                <span className="flex-1 min-w-40">{a.description}</span>
                <span className="text-xs text-muted-foreground">{nameOf(members, a.responsible_id)} · due {fmtDate(a.due_date)}</span>
                <NativeSelect aria-label="Action status" className="w-36" value={a.status} disabled={!editable}
                  onChange={(e) => run(() => registersApi.updateAction(projectId, nc.id, a.id, { status: e.target.value }))}>
                  {Object.entries(ACTION_STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </NativeSelect>
                {editable && (
                  <Button variant="ghost" size="icon" aria-label="Remove action" onClick={() => run(() => registersApi.removeAction(projectId, nc.id, a.id))}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
            {editable && (
              <div className="grid gap-2 sm:grid-cols-[2fr_1fr_auto_auto] sm:items-end">
                <Input aria-label="New corrective action" placeholder="New corrective action (eliminates the cause)" value={newAction.description}
                  onChange={(e) => setNewAction({ ...newAction, description: e.target.value })} />
                <PersonSelect members={members} value={newAction.responsible_id} placeholder="Responsible"
                  onChange={(v) => setNewAction({ ...newAction, responsible_id: v })} />
                <Input aria-label="Due date" type="date" value={newAction.due_date} onChange={(e) => setNewAction({ ...newAction, due_date: e.target.value })} />
                <Button size="sm" disabled={!newAction.description.trim() || !newAction.responsible_id}
                  onClick={async () => {
                    if (await run(() => registersApi.addAction(projectId, nc.id, { ...newAction, due_date: newAction.due_date || undefined }), 'Corrective action added and assigned')) {
                      setNewAction({ description: '', responsible_id: null, due_date: '' });
                    }
                  }}>
                  <Plus className="h-4 w-4 mr-1" />Add
                </Button>
              </div>
            )}
          </div>

          {nc.status === 'RESOLVED' && (
            <p className="rounded-md bg-green-50 px-3 py-2 text-green-800 dark:bg-green-900/20 dark:text-green-400">
              Effectiveness review ({nameOf(members, nc.effectiveness_verified_by)}, {fmtDate(nc.effectiveness_verified_at)}): {nc.effectiveness_review}
            </p>
          )}
          {nc.status === 'NOT_RELEVANT' && <p className="text-muted-foreground">Not relevant: {nc.not_relevant_reason}</p>}

          {canEdit && (
            <div className="flex flex-wrap items-end gap-2 border-t border-border/60 pt-3">
              {closed ? (
                <Button size="sm" variant="outline" onClick={() => run(() => registersApi.reopen(projectId, nc.id), 'Nonconformity reopened')}>Reopen</Button>
              ) : (
                <>
                  <div className="flex-1 min-w-60">
                    <Label htmlFor={`rev-${nc.id}`} className="text-xs">Review of effectiveness (required to resolve)</Label>
                    <Input id={`rev-${nc.id}`} value={review} onChange={(e) => setReview(e.target.value)} placeholder="Did the actions eliminate the cause?" />
                  </div>
                  <Button size="sm" disabled={!review.trim() || nc.status !== 'ACTIONS_DEFINED' || !allDone}
                    title={!allDone ? 'All corrective actions must be done first' : undefined}
                    onClick={() => run(() => registersApi.resolve(projectId, nc.id, review), 'Nonconformity resolved')}>
                    Resolve
                  </Button>
                  <div className="flex-1 min-w-48">
                    <Label htmlFor={`nr-${nc.id}`} className="text-xs">Or dismiss — reason</Label>
                    <Input id={`nr-${nc.id}`} value={reason} onChange={(e) => setReason(e.target.value)} />
                  </div>
                  <Button size="sm" variant="ghost" disabled={!reason.trim()} onClick={() => run(() => registersApi.notRelevant(projectId, nc.id, reason), 'Marked as not relevant')}>
                    Not relevant
                  </Button>
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Incidents ──────────────────────────────────────────────────

function IncidentRegister({ state, projectId, run }: { state: RegistersState; projectId: string; run: Run }) {
  const [adding, setAdding] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const [f, setF] = useState({ title: '', description: '', occurred_at: new Date().toISOString().slice(0, 10), severity: 'LOW' as Severity, responsible_id: null as string | null, affects_confidentiality: false, affects_integrity: false, affects_availability: false });
  const canEdit = state.permissions.canEdit;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Incident register</CardTitle>
        <CardDescription className="max-w-3xl leading-relaxed">
          Here you need to enter all events that could compromise the confidentiality, integrity or availability of your information.
          Assess each event (is it a security incident?), respond to it, collect evidence and record the lessons learned (controls A.5.24–A.5.28).
          If an incident was caused by not following your rules, raise a nonconformity.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {canEdit && !adding && <Button size="sm" onClick={() => setAdding(true)}><Plus className="h-4 w-4 mr-1" />Report an event</Button>}
        {adding && (
          <div className="rounded-lg border p-3 space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2"><Label htmlFor="inc-title" className="text-xs">Title *</Label>
                <Input id="inc-title" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></div>
              <div className="sm:col-span-2"><Label htmlFor="inc-desc" className="text-xs">What happened? *</Label>
                <Textarea id="inc-desc" rows={2} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></div>
              <div><Label htmlFor="inc-date" className="text-xs">Date occurred *</Label>
                <Input id="inc-date" type="date" value={f.occurred_at} onChange={(e) => setF({ ...f, occurred_at: e.target.value })} /></div>
              <div><Label htmlFor="inc-sev" className="text-xs">Severity</Label>
                <NativeSelect id="inc-sev" value={f.severity} onChange={(e) => setF({ ...f, severity: e.target.value as Severity })}>
                  <option value="LOW">Low</option><option value="MEDIUM">Medium</option><option value="HIGH">High</option>
                </NativeSelect></div>
              <div><Label className="text-xs">Responsible person</Label>
                <PersonSelect members={state.members} value={f.responsible_id} onChange={(v) => setF({ ...f, responsible_id: v })} /></div>
              <fieldset className="flex flex-wrap items-center gap-3 text-sm">
                <legend className="text-xs mb-1">Affected</legend>
                {(['confidentiality', 'integrity', 'availability'] as const).map(k => (
                  <label key={k} className="flex items-center gap-1.5">
                    <input type="checkbox" checked={f[`affects_${k}`]} onChange={(e) => setF({ ...f, [`affects_${k}`]: e.target.checked })} />{k}
                  </label>
                ))}
              </fieldset>
            </div>
            <div className="flex gap-2">
              <Button size="sm" disabled={!f.title.trim() || !f.description.trim()}
                onClick={async () => { if (await run(() => registersApi.createIncident(projectId, { ...f, responsible_id: f.responsible_id ?? undefined }), 'Event reported')) setAdding(false); }}>
                Save
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setAdding(false)}>Cancel</Button>
            </div>
          </div>
        )}
        {state.incidents.length === 0 && !adding && (
          <p className="text-sm text-muted-foreground py-6 text-center">There are no added incidents. To add an entry, click the button above.</p>
        )}
        {state.incidents.map(inc => (
          <IncidentRow key={inc.id} inc={inc} members={state.members} canEdit={canEdit} projectId={projectId} run={run}
            open={open === inc.id} onToggle={() => setOpen(open === inc.id ? null : inc.id)} />
        ))}
      </CardContent>
    </Card>
  );
}

function IncidentRow({ inc, members, canEdit, projectId, run, open, onToggle }: {
  inc: Incident; members: Member[]; canEdit: boolean; projectId: string; run: Run; open: boolean; onToggle: () => void;
}) {
  const editable = canEdit && inc.status !== 'CLOSED';
  const save = (d: Record<string, unknown>) => run(() => registersApi.updateIncident(projectId, inc.id, d));
  const affected = [inc.affects_confidentiality && 'C', inc.affects_integrity && 'I', inc.affects_availability && 'A'].filter(Boolean).join('');

  return (
    <div className="rounded-lg border border-border/60">
      <button type="button" onClick={onToggle} aria-expanded={open} className="flex w-full flex-wrap items-center gap-2 px-3 py-2 text-left text-sm hover:bg-accent/30">
        {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        <span className="font-mono text-xs">{incRef(inc.number)}</span>
        <span className="flex-1 min-w-40 font-medium">{inc.title}</span>
        <span className="text-xs text-muted-foreground">{fmtDate(inc.occurred_at)} · {inc.severity.toLowerCase()}{affected && ` · ${affected}`}</span>
        {inc.is_security_incident === true && <Badge className="bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400">Security incident</Badge>}
        <Badge variant="outline">{INCIDENT_STATUS[inc.status]}</Badge>
      </button>
      {open && (
        <div className="border-t border-border/60 p-3 space-y-3 text-sm">
          <p>{inc.description}</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div><Label className="text-xs">Responsible person</Label>
              <PersonSelect members={members} value={inc.responsible_id} disabled={!editable} onChange={(v) => save({ responsible_id: v })} /></div>
            <div><Label htmlFor={`sec-${inc.id}`} className="text-xs">Assessment: is it a security incident? (A.5.25)</Label>
              <NativeSelect id={`sec-${inc.id}`} value={inc.is_security_incident == null ? '' : String(inc.is_security_incident)} disabled={!editable}
                onChange={(e) => e.target.value && save({ is_security_incident: e.target.value === 'true' })}>
                <option value="">Not assessed</option><option value="true">Yes — security incident</option><option value="false">No — event only</option>
              </NativeSelect></div>
            <div className="sm:col-span-2"><Label className="text-xs">Assessment</Label>
              <BlurField multiline value={inc.assessment} disabled={!editable} onSave={(v) => save({ assessment: v })} /></div>
            <div><Label className="text-xs">Response (A.5.26)</Label>
              <BlurField multiline value={inc.response} disabled={!editable} onSave={(v) => save({ response: v })} /></div>
            <div><Label className="text-xs">Evidence collected (A.5.28)</Label>
              <BlurField multiline value={inc.evidence} disabled={!editable} onSave={(v) => save({ evidence: v })} /></div>
            <div className="sm:col-span-2"><Label className="text-xs">Lessons learned (A.5.27)</Label>
              <BlurField multiline value={inc.lessons_learned} disabled={!editable} onSave={(v) => save({ lessons_learned: v })} /></div>
          </div>
          <div className="flex flex-wrap items-end gap-2 border-t border-border/60 pt-3">
            <div className="w-44"><Label htmlFor={`st-${inc.id}`} className="text-xs">Status</Label>
              <NativeSelect id={`st-${inc.id}`} value={inc.status} disabled={!canEdit} onChange={(e) => save({ status: e.target.value })}>
                {Object.entries(INCIDENT_STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </NativeSelect></div>
            {canEdit && (
              <Button size="sm" variant="outline" onClick={() => run(() => registersApi.ncFromIncident(projectId, inc.id), 'Nonconformity raised')}>
                Raise a nonconformity
              </Button>
            )}
            {inc.nonconformities.length > 0 && (
              <span className="text-xs text-muted-foreground">Linked: {inc.nonconformities.map(n => ncRef(n.number)).join(', ')}</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

