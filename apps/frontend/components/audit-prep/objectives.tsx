'use client';

import { useCallback, useState } from 'react';
import { Check, ChevronDown, ChevronRight, Plus, Trash2 } from 'lucide-react';
import { objectivesApi, Frequency, Objective, ObjectivesState } from '@/lib/audit-prep-api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { Spinner } from '@/components/ui/spinner';
import {
  BlurField, Counters, DocumentCard, PersonSelect, ReadOnlyNotice, StepComponentProps, dateValue, docHref, fmtDate, nameOf, useRegister,
} from './shared';

export const FREQUENCIES: Record<Frequency, string> = {
  MONTHLY: 'Every month',
  QUARTERLY: 'Every quarter',
  SEMI_ANNUALLY: 'Every 6 months',
  YEARLY: 'Every year',
};

/** Phase 4 step 4: security objectives (clauses 6.2 and 9.1). */
export default function SecurityObjectives({ stepId, orgId, projectId, onCompletionChange }: StepComponentProps) {
  const load = useCallback(() => objectivesApi.get(stepId), [stepId]);
  const { state, loading, run } = useRegister<ObjectivesState>(load, onCompletionChange);
  const [open, setOpen] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState('');

  if (loading) return <div className="flex justify-center py-16"><Spinner className="h-6 w-6" /></div>;
  if (!state) return <p className="text-sm text-muted-foreground">Unable to load the objectives.</p>;
  const { permissions, counters } = state;

  return (
    <div className="space-y-4">
      <Counters items={[['Approved objectives', counters.approved], ['Awaiting approval', counters.awaiting], ['Objectives', state.objectives.length], ['Measured', state.objectives.filter(o => o.measurements.length > 0).length]]} />
      <ReadOnlyNotice show={!permissions.canEdit} />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Security objectives</CardTitle>
          <CardDescription className="max-w-3xl leading-relaxed">
            Eight typical objectives are suggested — adapt them, delete the ones that do not fit, or add your own. For each objective define
            what will be done, the resources, who is responsible, when it will be completed and how the results are evaluated (clause 6.2).
            Top management then confirms the objectives; they are measured with the chosen frequency and reported to the management review.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {state.objectives.map(o => (
            <ObjectiveRow key={o.id} o={o} state={state} stepId={stepId} run={run} open={open === o.id} onToggle={() => setOpen(open === o.id ? null : o.id)} />
          ))}
          {permissions.canEdit && (
            <div className="flex gap-2 pt-2">
              <Input aria-label="New objective" placeholder="Add a new objective" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} />
              <Button size="sm" disabled={!newTitle.trim()}
                onClick={async () => { if (await run(() => objectivesApi.create(stepId, { title: newTitle }), 'Objective added')) setNewTitle(''); }}>
                <Plus className="h-4 w-4 mr-1" />Add new objective
              </Button>
            </div>
          )}
          {permissions.canEdit && (
            <div className="flex flex-wrap items-center justify-end gap-3 border-t border-border/60 pt-3">
              {!permissions.canDecide && counters.awaiting > 0 && (
                <span className="text-xs text-muted-foreground">Top management (or the project lead) confirms the objectives.</span>
              )}
              <Button disabled={!permissions.canDecide || counters.awaiting === 0}
                onClick={() => run(() => objectivesApi.confirm(stepId), 'Objectives approved')}>
                <Check className="h-4 w-4 mr-1" />Confirm objectives ({counters.awaiting})
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <DocumentCard title="List of Security Objectives and Fulfilment Report" documents={state.documents} canEdit={permissions.canEdit}
        description="The approved objectives with their owners and measurement methods, and the measured results."
        onGenerate={() => run(() => objectivesApi.document(stepId), 'Document generated')} href={docHref(orgId, projectId)} />
    </div>
  );
}

function ObjectiveRow({ o, state, stepId, run, open, onToggle }: {
  o: Objective; state: ObjectivesState; stepId: string; open: boolean; onToggle: () => void;
  run: (fn: () => Promise<ObjectivesState>, s?: string) => Promise<boolean>;
}) {
  const { permissions, members } = state;
  const canEdit = permissions.canEdit;
  const save = (d: Record<string, unknown>) => run(() => objectivesApi.update(stepId, o.id, d));
  const [m, setM] = useState({ measured_on: new Date().toISOString().slice(0, 10), result: '', achieved: true });

  return (
    <div className="rounded-lg border border-border/60">
      <button type="button" onClick={onToggle} aria-expanded={open} className="flex w-full flex-wrap items-center gap-2 px-3 py-2 text-left text-sm hover:bg-accent/30">
        {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        <span className="flex-1 min-w-48">{o.title}</span>
        <span className="text-xs text-muted-foreground">{nameOf(members, o.responsible_id)} · {FREQUENCIES[o.frequency]}</span>
        <Badge className={o.status === 'APPROVED' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'}>
          {o.status === 'APPROVED' ? 'Approved' : 'Draft'}
        </Badge>
      </button>
      {open && (
        <div className="border-t border-border/60 p-3 space-y-3 text-sm">
          {o.status === 'APPROVED' && canEdit && (
            <p className="text-xs text-muted-foreground">Changing an approved objective sends it back to draft for a new approval.</p>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2"><Label className="text-xs">Objective</Label>
              <BlurField value={o.title} disabled={!canEdit} onSave={(v) => v.trim() && save({ title: v })} /></div>
            <div><Label className="text-xs">What will be done</Label>
              <BlurField multiline value={o.action_plan} disabled={!canEdit} onSave={(v) => save({ action_plan: v })} /></div>
            <div><Label className="text-xs">Resources</Label>
              <BlurField multiline value={o.resources} disabled={!canEdit} onSave={(v) => save({ resources: v })} /></div>
            <div><Label className="text-xs">Responsible person *</Label>
              <PersonSelect members={members} value={o.responsible_id} disabled={!canEdit} onChange={(v) => save({ responsible_id: v })} /></div>
            <div><Label className="text-xs">To be completed by</Label>
              <Input type="date" aria-label="Due date" value={dateValue(o.due_date)} disabled={!canEdit} onChange={(e) => save({ due_date: e.target.value || null })} /></div>
            <div><Label className="text-xs">How results are evaluated (measurement) *</Label>
              <BlurField multiline value={o.measurement} disabled={!canEdit} onSave={(v) => save({ measurement: v })} /></div>
            <div><Label htmlFor={`fr-${o.id}`} className="text-xs">Measurement frequency</Label>
              <NativeSelect id={`fr-${o.id}`} value={o.frequency} disabled={!canEdit} onChange={(e) => save({ frequency: e.target.value })}>
                {Object.entries(FREQUENCIES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </NativeSelect></div>
          </div>

          <div className="space-y-2 border-t border-border/60 pt-3">
            <p className="text-xs font-medium">Measurements (clause 9.1)</p>
            {o.measurements.length === 0 && <p className="text-xs text-muted-foreground">Not measured yet.</p>}
            {o.measurements.map(ms => (
              <p key={ms.id} className="text-xs">
                {fmtDate(ms.measured_on)} — {ms.result} — <strong>{ms.achieved ? 'achieved' : 'not achieved'}</strong>{ms.comment && ` (${ms.comment})`}
              </p>
            ))}
            {canEdit && o.status === 'APPROVED' && (
              <div className="grid gap-2 sm:grid-cols-[auto_2fr_auto_auto] sm:items-center">
                <Input type="date" aria-label="Measured on" value={m.measured_on} onChange={(e) => setM({ ...m, measured_on: e.target.value })} />
                <Input aria-label="Result" placeholder="Result, e.g. 9 incidents (-10%)" value={m.result} onChange={(e) => setM({ ...m, result: e.target.value })} />
                <label className="flex items-center gap-1.5 text-xs"><input type="checkbox" checked={m.achieved} onChange={(e) => setM({ ...m, achieved: e.target.checked })} />Achieved</label>
                <Button size="sm" disabled={!m.result.trim()}
                  onClick={async () => { if (await run(() => objectivesApi.measure(stepId, o.id, m), 'Measurement recorded')) setM({ ...m, result: '' }); }}>
                  Record
                </Button>
              </div>
            )}
          </div>

          {canEdit && o.measurements.length === 0 && (
            <Button size="sm" variant="ghost" className="text-destructive" onClick={() => window.confirm('Delete this objective?') && run(() => objectivesApi.remove(stepId, o.id), 'Objective deleted')}>
              <Trash2 className="h-4 w-4 mr-1" />Delete objective
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
