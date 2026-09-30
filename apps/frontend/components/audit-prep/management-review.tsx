'use client';

import { useCallback, useEffect, useState } from 'react';
import { Check, Plus, RefreshCw, Trash2 } from 'lucide-react';
import {
  reviewsApi, ActionStatus, DecisionType, Frequency, Review, ReviewItem, ReviewSetupState, ReviewsState,
} from '@/lib/audit-prep-api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { Spinner } from '@/components/ui/spinner';
import {
  BlurField, Counters, DocumentCard, PeoplePicker, PersonSelect, ReadOnlyNotice, StepComponentProps, dateValue, docHref, fmtDate, nameOf, useRegister,
} from './shared';
import { FREQUENCIES } from './objectives';

const DECISIONS: Record<DecisionType, string> = {
  IMPROVEMENT: 'Continual improvement opportunity',
  ISMS_CHANGE: 'Change to the ISMS',
  RESOURCES: 'Resource need',
  OTHER: 'Other decision',
};
const ACTION_STATUS: Record<ActionStatus, string> = { PLANNED: 'Planned', IN_PROGRESS: 'In progress', DONE: 'Completed' };

// ─── Step 5: setting up management review ───────────────────────

export function ManagementReviewSetup({ stepId, onCompletionChange }: StepComponentProps) {
  const load = useCallback(() => reviewsApi.getSetup(stepId), [stepId]);
  const { state, loading, run } = useRegister<ReviewSetupState>(load, onCompletionChange);
  const [draft, setDraft] = useState<{ frequency: Frequency; next_review_date: string; reviewer_ids: string[]; items: ReviewItem[] } | null>(null);
  const [newItem, setNewItem] = useState('');

  useEffect(() => {
    if (state) {
      setDraft({
        frequency: state.setup.frequency,
        next_review_date: dateValue(state.setup.next_review_date),
        reviewer_ids: state.setup.reviewer_ids,
        items: state.setup.items,
      });
    }
  }, [state]);

  if (loading) return <div className="flex justify-center py-16"><Spinner className="h-6 w-6" /></div>;
  if (!state || !draft) return <p className="text-sm text-muted-foreground">Unable to load the management review setup.</p>;
  const canEdit = state.permissions.canEdit;
  const topManagement = state.members.filter(m => m.is_top_management || m.privilege === 'PROJECT_LEAD');

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Management review items</CardTitle>
          <CardDescription className="max-w-3xl leading-relaxed">
            The management review is where top management gets insight into how information security is doing. Below are the items to be reviewed,
            the materials to present and how often the review is held. The inputs of ISO 27001 clause 9.3.2 are mandatory; you can adapt their
            materials and add your own items. {canEdit ? '' : 'Only top management (the Sponsor) or the project lead can edit these items.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div><Label htmlFor="mr-freq" className="text-xs">Frequency of the review</Label>
              <NativeSelect id="mr-freq" value={draft.frequency} disabled={!canEdit} onChange={(e) => setDraft({ ...draft, frequency: e.target.value as Frequency })}>
                {Object.entries(FREQUENCIES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </NativeSelect></div>
            <div><Label htmlFor="mr-date" className="text-xs">Date of the first management review *</Label>
              <Input id="mr-date" type="date" value={draft.next_review_date} disabled={!canEdit} onChange={(e) => setDraft({ ...draft, next_review_date: e.target.value })} /></div>
            <div className="sm:col-span-2"><Label className="text-xs">Reviewers (top management) *</Label>
              <PeoplePicker members={topManagement} value={draft.reviewer_ids} disabled={!canEdit} onChange={(ids) => setDraft({ ...draft, reviewer_ids: ids })} />
              {topManagement.length === 0 && <p className="text-xs text-muted-foreground mt-1">Give the Top management ISO role to the relevant members in the project members page.</p>}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b text-left text-xs text-muted-foreground"><th className="py-2 pr-2">Item to be reviewed</th><th className="py-2 pr-2">Materials</th><th className="py-2 w-8" /></tr></thead>
              <tbody>
                {draft.items.map((it, idx) => (
                  <tr key={it.key} className="border-b border-border/40 align-top">
                    <td className="py-2 pr-2">{it.title}{it.mandatory && <Badge variant="outline" className="ml-2 text-[10px]">ISO {it.key.replace('9.3.2', '9.3.2 ')}</Badge>}</td>
                    <td className="py-2 pr-2">
                      <Input aria-label={`Materials for ${it.title}`} value={it.materials ?? ''} disabled={!canEdit}
                        onChange={(e) => setDraft({ ...draft, items: draft.items.map((x, j) => (j === idx ? { ...x, materials: e.target.value } : x)) })} />
                    </td>
                    <td className="py-2">
                      {!it.mandatory && canEdit && (
                        <Button variant="ghost" size="icon" aria-label="Remove item" onClick={() => setDraft({ ...draft, items: draft.items.filter((_, j) => j !== idx) })}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {canEdit && (
            <div className="flex gap-2">
              <Input aria-label="New review item" placeholder="Add your own item (e.g. status of the certification project)" value={newItem} onChange={(e) => setNewItem(e.target.value)} />
              <Button size="sm" variant="outline" disabled={!newItem.trim()}
                onClick={() => { setDraft({ ...draft, items: [...draft.items, { key: `custom-${Date.now()}`, title: newItem.trim(), materials: '' }] }); setNewItem(''); }}>
                <Plus className="h-4 w-4 mr-1" />Add item
              </Button>
            </div>
          )}
          {canEdit && (
            <div className="flex items-center justify-end gap-3">
              {state.setup.configured_at && <span className="text-xs text-muted-foreground">Last saved {fmtDate(state.setup.configured_at)}</span>}
              <Button disabled={draft.reviewer_ids.length === 0 || !draft.next_review_date}
                onClick={() => run(() => reviewsApi.saveSetup(stepId, { ...draft, next_review_date: draft.next_review_date || null }), 'Management review set up')}>
                <Check className="h-4 w-4 mr-1" />Save settings
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Step 7: management review meeting ──────────────────────────

export function ManagementReviewMeeting({ stepId, orgId, projectId, onCompletionChange }: StepComponentProps) {
  const load = useCallback(() => reviewsApi.get(stepId), [stepId]);
  const { state, loading, run } = useRegister<ReviewsState>(load, onCompletionChange);
  const [f, setF] = useState<{ review_date: string; participant_ids: string[] } | null>(null);

  useEffect(() => {
    if (state && !f) {
      setF({ review_date: dateValue(state.setup?.next_review_date) || new Date().toISOString().slice(0, 10), participant_ids: state.setup?.reviewer_ids ?? [] });
    }
  }, [state, f]);

  if (loading) return <div className="flex justify-center py-16"><Spinner className="h-6 w-6" /></div>;
  if (!state || !f) return <p className="text-sm text-muted-foreground">Unable to load the management review.</p>;
  const { permissions, counters } = state;
  const current = state.reviews.find(r => r.status !== 'COMPLETED');
  const past = state.reviews.filter(r => r.status === 'COMPLETED');

  return (
    <div className="space-y-4">
      <Counters items={[['Planned activities', counters.planned], ['Late activities', counters.late], ['Completed activities', counters.completed], ['Reviews held', past.length]]} />
      <ReadOnlyNotice show={!permissions.canEdit} />

      {!state.setup?.configured_at && (
        <p className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-900/20 dark:text-amber-300">
          Set up the management review first (step &quot;Setting Up Management Review&quot;).
        </p>
      )}

      {!current && state.setup?.configured_at && permissions.canEdit && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Start management review</CardTitle>
            <CardDescription>
              The platform prepares every review input with a summary from your registers — nonconformities, incidents, audits, objectives, risks and the treatment plan.
              {state.setup.next_review_date && ` Next review planned on ${fmtDate(state.setup.next_review_date)}.`}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-[auto_1fr] sm:items-start">
              <div><Label htmlFor="rv-date" className="text-xs">Date of the review</Label>
                <Input id="rv-date" type="date" value={f.review_date} onChange={(e) => setF({ ...f, review_date: e.target.value })} /></div>
              <div><Label className="text-xs">Participants (top management must take part)</Label>
                <PeoplePicker members={state.members} value={f.participant_ids} onChange={(ids) => setF({ ...f, participant_ids: ids })} /></div>
            </div>
            <Button disabled={f.participant_ids.length === 0} onClick={() => run(() => reviewsApi.create(stepId, f), 'Management review started')}>
              Start management review
            </Button>
          </CardContent>
        </Card>
      )}

      {current && <ReviewMeeting review={current} state={state} stepId={stepId} run={run} />}

      {past.map(r => <ReviewSummary key={r.id} review={r} state={state} stepId={stepId} run={run} />)}

      <DocumentCard title="Management Review Minutes" documents={state.documents} canEdit={permissions.canEdit}
        description="Inputs, decisions and conclusions of the latest completed review (clause 9.3)."
        onGenerate={() => run(() => reviewsApi.document(stepId), 'Minutes generated')} href={docHref(orgId, projectId)} />
    </div>
  );
}

type Run = (fn: () => Promise<ReviewsState>, s?: string) => Promise<boolean>;

function ReviewMeeting({ review: r, state, stepId, run }: { review: Review; state: ReviewsState; stepId: string; run: Run }) {
  const { members } = state;
  const [d, setD] = useState({ type: 'IMPROVEMENT' as DecisionType, description: '', responsible_id: null as string | null, due_date: '' });
  const pending = r.inputs.filter(i => !i.discussed).length;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex flex-wrap items-center gap-2">{r.title}<Badge variant="outline">In progress</Badge></CardTitle>
        <CardDescription>
          {fmtDate(r.review_date)} · Participants: {r.participant_ids.map(id => nameOf(members, id)).join(', ')}.
          Go through each input, record the discussion, then the decisions and conclusions.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex justify-end">
          <Button size="sm" variant="outline" onClick={() => run(() => reviewsApi.refresh(stepId, r.id), 'Summaries refreshed')}>
            <RefreshCw className="h-4 w-4 mr-1" />Refresh summaries
          </Button>
        </div>
        {r.inputs.map(i => (
          <div key={i.id} className={`rounded-lg border p-3 space-y-2 text-sm ${i.discussed ? 'border-green-300 dark:border-green-800' : 'border-border/60'}`}>
            <div className="flex flex-wrap items-center gap-2">
              <span className="flex-1 font-medium">{i.title}</span>
              <label className="flex items-center gap-1.5 text-xs">
                <input type="checkbox" checked={i.discussed} onChange={(e) => run(() => reviewsApi.updateInput(stepId, r.id, i.id, { discussed: e.target.checked }))} />
                Discussed
              </label>
            </div>
            <p className="rounded-md bg-muted/50 px-2.5 py-1.5 text-muted-foreground">{i.summary}</p>
            <BlurField multiline value={i.notes} placeholder="Discussion and observations of top management"
              onSave={(v) => run(() => reviewsApi.updateInput(stepId, r.id, i.id, { notes: v }))} />
          </div>
        ))}

        <div className="space-y-2 border-t border-border/60 pt-3">
          <p className="text-sm font-medium">Decisions and actions (clause 9.3.3)</p>
          {r.decisions.map(dec => (
            <div key={dec.id} className="flex flex-wrap items-center gap-2 rounded-md border px-2.5 py-1.5 text-sm">
              <Badge variant="outline" className="text-xs">{DECISIONS[dec.type]}</Badge>
              <span className="flex-1 min-w-40">{dec.description}</span>
              <PersonSelect members={members} value={dec.responsible_id} placeholder="Responsible"
                onChange={(v) => run(() => reviewsApi.updateDecision(stepId, r.id, dec.id, { responsible_id: v }))} />
              <Input type="date" aria-label="Due date" className="w-40" value={dateValue(dec.due_date)}
                onChange={(e) => run(() => reviewsApi.updateDecision(stepId, r.id, dec.id, { due_date: e.target.value || null }))} />
              <Button variant="ghost" size="icon" aria-label="Remove decision" onClick={() => run(() => reviewsApi.removeDecision(stepId, r.id, dec.id))}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
          <div className="grid gap-2 sm:grid-cols-[auto_2fr_1fr_auto_auto] sm:items-center">
            <NativeSelect aria-label="Decision type" value={d.type} onChange={(e) => setD({ ...d, type: e.target.value as DecisionType })}>
              {Object.entries(DECISIONS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </NativeSelect>
            <Input aria-label="Decision" placeholder="Decision or action" value={d.description} onChange={(e) => setD({ ...d, description: e.target.value })} />
            <PersonSelect members={members} value={d.responsible_id} placeholder="Responsible" onChange={(v) => setD({ ...d, responsible_id: v })} />
            <Input type="date" aria-label="New decision due date" value={d.due_date} onChange={(e) => setD({ ...d, due_date: e.target.value })} />
            <Button size="sm" disabled={!d.description.trim()}
              onClick={async () => {
                if (await run(() => reviewsApi.addDecision(stepId, r.id, { ...d, due_date: d.due_date || null }))) {
                  setD({ type: 'IMPROVEMENT', description: '', responsible_id: null, due_date: '' });
                }
              }}>
              <Plus className="h-4 w-4 mr-1" />Add
            </Button>
          </div>
        </div>

        <div className="space-y-2 border-t border-border/60 pt-3">
          <Label className="text-sm font-medium">Conclusions of top management *</Label>
          <BlurField multiline value={r.conclusions} placeholder="Is the ISMS suitable, adequate and effective? Any change needed?"
            onSave={(v) => run(() => reviewsApi.update(stepId, r.id, { conclusions: v }))} />
        </div>

        <div className="flex flex-wrap items-center justify-end gap-3">
          {pending > 0 && <span className="text-xs text-muted-foreground">{pending} input(s) not discussed yet</span>}
          <Button disabled={pending > 0 || !r.conclusions?.trim()}
            onClick={() => run(() => reviewsApi.complete(stepId, r.id), 'Management review completed — actions assigned')}>
            <Check className="h-4 w-4 mr-1" />Complete the review
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function ReviewSummary({ review: r, state, stepId, run }: { review: Review; state: ReviewsState; stepId: string; run: Run }) {
  const now = new Date();
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex flex-wrap items-center gap-2">{r.title}<Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">Completed</Badge></CardTitle>
        <CardDescription>{fmtDate(r.review_date)} · {r.conclusions}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        <p className="text-xs font-medium">Follow-up of decisions</p>
        {r.decisions.length === 0 && <p className="text-xs text-muted-foreground">No actions were decided.</p>}
        {r.decisions.map(dec => {
          const late = dec.status !== 'DONE' && dec.due_date && new Date(dec.due_date) < now;
          return (
            <div key={dec.id} className="flex flex-wrap items-center gap-2 rounded-md border px-2.5 py-1.5">
              <span className="flex-1 min-w-40">{dec.description}</span>
              <span className="text-xs text-muted-foreground">{nameOf(state.members, dec.responsible_id)} · due {fmtDate(dec.due_date)}</span>
              {late && <Badge className="bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400">Late</Badge>}
              <NativeSelect aria-label="Action status" className="w-36" value={dec.status} disabled={!state.permissions.canEdit}
                onChange={(e) => run(() => reviewsApi.updateDecision(stepId, r.id, dec.id, { status: e.target.value }))}>
                {Object.entries(ACTION_STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </NativeSelect>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

