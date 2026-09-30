'use client';

import { useCallback, useState } from 'react';
import { Check, Download, Plus, Trash2 } from 'lucide-react';
import { trainingsApi, Training, TrainingStatus, TrainingsState } from '@/lib/audit-prep-api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { Spinner } from '@/components/ui/spinner';
import {
  BlurField, Counters, DocumentCard, PeoplePicker, ReadOnlyNotice, StepComponentProps, dateValue, docHref, fmtDate, nameOf, useRegister,
} from './shared';

const STATUS: Record<TrainingStatus, [string, string]> = {
  PROPOSED: ['Awaiting approval', 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'],
  APPROVED: ['Approved', 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'],
  SCHEDULED: ['Scheduled', 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400'],
  PERFORMED: ['Performed', 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'],
  CANCELLED: ['Cancelled', 'bg-muted text-muted-foreground'],
};

/** Phase 4 step 3: Training Plan and Record (clause 7.2, A.6.3). */
export default function TrainingPlan({ stepId, orgId, projectId, onCompletionChange }: StepComponentProps) {
  const load = useCallback(() => trainingsApi.get(stepId), [stepId]);
  const { state, loading, run } = useRegister<TrainingsState>(load, onCompletionChange);
  const [adding, setAdding] = useState(false);
  const [f, setF] = useState({ title: '', skills: '', participant_ids: [] as string[], method: '', provider: '', planned_date: '' });

  if (loading) return <div className="flex justify-center py-16"><Spinner className="h-6 w-6" /></div>;
  if (!state) return <p className="text-sm text-muted-foreground">Unable to load the training plan.</p>;
  const { permissions, counters } = state;

  return (
    <div className="space-y-4">
      <Counters items={[['Approved trainings', counters.approved], ['Scheduled trainings', counters.scheduled], ['Performed trainings', counters.performed], ['Awaiting approval', counters.proposed]]} />
      <ReadOnlyNotice show={!permissions.canEdit} />

      {state.pendingNeeds.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Training needs from the steps</CardTitle>
            <CardDescription>These were entered in the Training section of the implementation steps. Import them into the plan.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <ul className="space-y-1 text-sm">
              {state.pendingNeeds.map(n => (
                <li key={n.source_key}>
                  <span className="font-medium">{nameOf(state.members, n.row.user_id)}</span> — {n.row.skills}
                  {n.row.training && ` (${n.row.training})`} <span className="text-xs text-muted-foreground">· from {n.step_title}</span>
                </li>
              ))}
            </ul>
            {permissions.canEdit && (
              <Button size="sm" onClick={() => run(() => trainingsApi.importNeeds(stepId), 'Training needs imported')}>
                <Download className="h-4 w-4 mr-1" />Import {state.pendingNeeds.length} need(s)
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Trainings</CardTitle>
          <CardDescription className="max-w-3xl leading-relaxed">
            Define which people will need to attend which security trainings. Top management approves each training; then schedule it,
            and once performed record the evidence (attendance list, certificates) and evaluate its effectiveness (clause 7.2).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {permissions.canEdit && !adding && <Button size="sm" onClick={() => setAdding(true)}><Plus className="h-4 w-4 mr-1" />New training</Button>}
          {adding && (
            <div className="rounded-lg border p-3 space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div><Label htmlFor="tr-title" className="text-xs">Training *</Label>
                  <Input id="tr-title" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="e.g. Security awareness for all employees" /></div>
                <div><Label htmlFor="tr-skills" className="text-xs">Knowledge and skills *</Label>
                  <Input id="tr-skills" value={f.skills} onChange={(e) => setF({ ...f, skills: e.target.value })} /></div>
                <div><Label htmlFor="tr-method" className="text-xs">Method</Label>
                  <Input id="tr-method" value={f.method} onChange={(e) => setF({ ...f, method: e.target.value })} placeholder="Classroom, e-learning, workshop…" /></div>
                <div><Label htmlFor="tr-prov" className="text-xs">Provider</Label>
                  <Input id="tr-prov" value={f.provider} onChange={(e) => setF({ ...f, provider: e.target.value })} /></div>
                <div><Label htmlFor="tr-date" className="text-xs">Planned date</Label>
                  <Input id="tr-date" type="date" value={f.planned_date} onChange={(e) => setF({ ...f, planned_date: e.target.value })} /></div>
                <div className="sm:col-span-2"><Label className="text-xs">Participants *</Label>
                  <PeoplePicker members={state.members} value={f.participant_ids} onChange={(ids) => setF({ ...f, participant_ids: ids })} /></div>
              </div>
              <div className="flex gap-2">
                <Button size="sm" disabled={!f.title.trim() || !f.skills.trim() || f.participant_ids.length === 0}
                  onClick={async () => {
                    if (await run(() => trainingsApi.create(stepId, { ...f, planned_date: f.planned_date || undefined }), 'Training added')) {
                      setAdding(false);
                      setF({ title: '', skills: '', participant_ids: [], method: '', provider: '', planned_date: '' });
                    }
                  }}>Save</Button>
                <Button size="sm" variant="ghost" onClick={() => setAdding(false)}>Cancel</Button>
              </div>
            </div>
          )}
          {state.trainings.length === 0 && !adding && (
            <p className="text-sm text-muted-foreground py-6 text-center">No trainings. You can add a new training by clicking the New training button.</p>
          )}
          {state.trainings.map(t => <TrainingRow key={t.id} t={t} state={state} stepId={stepId} run={run} />)}
        </CardContent>
      </Card>

      <DocumentCard title="Training Plan and Record" documents={state.documents} canEdit={permissions.canEdit}
        description="One document that is both the plan and the record of trainings — the competence evidence auditors ask for."
        onGenerate={() => run(() => trainingsApi.document(stepId), 'Document generated')} href={docHref(orgId, projectId)} />
    </div>
  );
}

function TrainingRow({ t, state, stepId, run }: {
  t: Training; state: TrainingsState; stepId: string; run: (fn: () => Promise<TrainingsState>, s?: string) => Promise<boolean>;
}) {
  const { permissions, members } = state;
  const canEdit = permissions.canEdit && t.status !== 'CANCELLED';
  const save = (d: Record<string, unknown>, msg?: string) => run(() => trainingsApi.update(stepId, t.id, d), msg);
  const [label, cls] = STATUS[t.status];

  return (
    <div className="rounded-lg border border-border/60 p-3 space-y-2 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className="flex-1 min-w-40 font-medium">{t.title}</span>
        <Badge className={cls}>{label}</Badge>
      </div>
      <p className="text-muted-foreground">{t.skills}</p>
      <p className="text-xs text-muted-foreground">
        Participants: {t.participant_ids.map(id => nameOf(members, id)).join(', ')}
        {(t.method || t.provider) && ` · ${[t.method, t.provider].filter(Boolean).join(' / ')}`}
        {t.approved_by && ` · approved by ${nameOf(members, t.approved_by)} on ${fmtDate(t.approved_at)}`}
      </p>
      <div className="grid gap-3 sm:grid-cols-4 sm:items-end">
        <div><Label className="text-xs">Planned date</Label>
          <Input type="date" aria-label="Planned date" value={dateValue(t.planned_date)} disabled={!canEdit} onChange={(e) => save({ planned_date: e.target.value || null })} /></div>
        <div><Label className="text-xs">Performed on</Label>
          <Input type="date" aria-label="Performed on" value={dateValue(t.performed_date)} disabled={!canEdit} onChange={(e) => save({ performed_date: e.target.value || null })} /></div>
        <div className="sm:col-span-2 flex flex-wrap gap-2">
          {t.status === 'PROPOSED' && permissions.canDecide && permissions.canEdit && (
            <Button size="sm" onClick={() => run(() => trainingsApi.approve(stepId, t.id), 'Training approved')}><Check className="h-4 w-4 mr-1" />Approve</Button>
          )}
          {t.status === 'PROPOSED' && !permissions.canDecide && <span className="text-xs text-muted-foreground">Awaiting top management approval</span>}
          {canEdit && t.status !== 'PROPOSED' && (
            <NativeSelect aria-label="Training status" className="w-40" value={t.status} onChange={(e) => save({ status: e.target.value }, 'Status updated')}>
              <option value={t.status}>{STATUS[t.status][0]}</option>
              {(['SCHEDULED', 'PERFORMED', 'CANCELLED'] as TrainingStatus[]).filter(s => s !== t.status).map(s => <option key={s} value={s}>{STATUS[s][0]}</option>)}
            </NativeSelect>
          )}
          {canEdit && t.status !== 'PERFORMED' && (
            <Button size="sm" variant="ghost" aria-label="Delete training" onClick={() => window.confirm('Delete this training?') && run(() => trainingsApi.remove(stepId, t.id), 'Training deleted')}>
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
      {(t.status === 'SCHEDULED' || t.status === 'PERFORMED') && (
        <div className="grid gap-3 sm:grid-cols-2">
          <div><Label className="text-xs">Evidence (attendance list, certificates)</Label>
            <BlurField multiline value={t.evidence} disabled={!canEdit} onSave={(v) => save({ evidence: v })} /></div>
          <div><Label className="text-xs">Effectiveness evaluation (clause 7.2 c)</Label>
            <BlurField multiline value={t.effectiveness} disabled={!canEdit} placeholder="e.g. quiz results, observed behaviour"
              onSave={(v) => save({ effectiveness: v })} /></div>
        </div>
      )}
    </div>
  );
}
