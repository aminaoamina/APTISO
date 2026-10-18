'use client';

import { useState } from 'react';
import { CheckCircle2, ExternalLink, Loader2, Plus, Send, Trash2 } from 'lucide-react';
import { projectsApi } from '@/lib/api';
import type { AwarenessMaterial } from '@/lib/step-materials';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { toast } from 'sonner';
import { getErrorMessage } from '@/lib/utils';

type Member = { user_id: string; user: { first_name: string; last_name: string } };
type SentAwareness = { materials: { title: string; url?: string }[]; user_ids: string[]; sent_at: string };
type ConfirmedTraining = { rows: { user_id: string; skills: string; training?: string }[]; confirmed_at: string };

const memberName = (members: Member[], id: string) => {
  const m = members.find(x => x.user_id === id);
  return m ? `${m.user.first_name} ${m.user.last_name}` : 'Unknown member';
};

// ─── Awareness (clause 7.3) ─────────────────────────────────────

export function AwarenessPanel({
  projectId,
  stepId,
  stepTitle,
  materials,
  members,
  sent,
  canEdit,
  onSaved,
}: {
  projectId: string;
  stepId: string;
  stepTitle: string;
  materials: AwarenessMaterial[];
  members: Member[];
  sent?: SentAwareness;
  canEdit: boolean;
  onSaved: (completionData: Record<string, unknown>) => void;
}) {
  const [assigned, setAssigned] = useState<Set<number>>(new Set(materials.map((_, i) => i)));
  const [extra, setExtra] = useState<{ title: string; url: string }[]>([]);
  const [people, setPeople] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  const send = async () => {
    const chosen = [
      ...materials.filter((_, i) => assigned.has(i)).map(m => ({ title: `${m.kind}: ${m.title}`, url: m.url })),
      ...extra.filter(e => e.title.trim()).map(e => ({ title: e.title.trim(), url: e.url.trim() || undefined })),
    ];
    if (chosen.length === 0) return toast.error('Select at least one material');
    if (people.size === 0) return toast.error('Select at least one person');
    setBusy(true);
    try {
      const step = await projectsApi.sendAwareness(projectId, stepId, { materials: chosen, user_ids: [...people] });
      onSaved((step.completion_data as Record<string, unknown>) ?? {});
      toast.success(`Materials sent to ${people.size} person(s)`);
      setPeople(new Set());
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to send materials'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Awareness</CardTitle>
        <CardDescription>
          {materials.length
            ? <>To make your people aware of the need to complete &quot;{stepTitle}&quot;, we suggest the following materials.</>
            : <>Add what your people should read for &quot;{stepTitle}&quot;, for example the document of this step or a policy link.</>}
          {' '}Each person receives a task with the selected materials (clause 7.3).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {sent && (
          <p className="flex items-start gap-2 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-800 dark:bg-green-900/20 dark:text-green-400">
            <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" />
            Sent on {new Date(sent.sent_at).toLocaleDateString()} to {sent.user_ids.map(id => memberName(members, id)).join(', ')}.
          </p>
        )}

        <fieldset className="space-y-2">
          <legend className="text-xs font-medium text-muted-foreground mb-1">Materials (Assign?)</legend>
          {materials.map((m, i) => (
            <label key={m.title} className="flex items-start gap-2 text-sm">
              <input type="checkbox" className="mt-1" disabled={!canEdit} checked={assigned.has(i)}
                onChange={() => setAssigned(prev => { const n = new Set(prev); if (n.has(i)) n.delete(i); else n.add(i); return n; })} />
              <span>
                <span className="text-muted-foreground">{m.kind}:</span>{' '}
                {m.url ? (
                  <a href={m.url} target="_blank" rel="noopener noreferrer" className="text-[var(--brand-orange)] hover:underline inline-flex items-center gap-1">
                    {m.title}<ExternalLink className="h-3 w-3" />
                  </a>
                ) : m.title}
              </span>
            </label>
          ))}
          {extra.map((e, i) => (
            <div key={i} className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
              <Input aria-label="Material title" placeholder="Title (e.g. internal training slides)" value={e.title}
                onChange={(ev) => setExtra(prev => prev.map((x, j) => (j === i ? { ...x, title: ev.target.value } : x)))} />
              <Input aria-label="Material link" placeholder="https://… (optional)" value={e.url}
                onChange={(ev) => setExtra(prev => prev.map((x, j) => (j === i ? { ...x, url: ev.target.value } : x)))} />
              <Button variant="ghost" size="icon" aria-label="Remove material" onClick={() => setExtra(prev => prev.filter((_, j) => j !== i))}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
          {canEdit && (
            <Button variant="ghost" size="sm" onClick={() => setExtra(prev => [...prev, { title: '', url: '' }])}>
              <Plus className="h-4 w-4 mr-1" />Add your own material
            </Button>
          )}
        </fieldset>

        {canEdit && (
          <>
            <fieldset>
              <legend className="text-xs font-medium text-muted-foreground mb-2">People assigned</legend>
              <div className="flex flex-wrap gap-2">
                {members.map(m => {
                  const active = people.has(m.user_id);
                  return (
                    <button key={m.user_id} type="button" aria-pressed={active}
                      onClick={() => setPeople(prev => { const n = new Set(prev); if (n.has(m.user_id)) n.delete(m.user_id); else n.add(m.user_id); return n; })}
                      className={`rounded-full border px-3 py-1 text-sm ${active ? 'border-[var(--brand-orange)] bg-[var(--brand-orange)]/10' : 'border-border text-muted-foreground hover:bg-accent'}`}>
                      {m.user.first_name} {m.user.last_name}
                    </button>
                  );
                })}
              </div>
            </fieldset>
            <Button onClick={send} disabled={busy}>
              {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}Send materials
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Training (clause 7.2) ──────────────────────────────────────

export function TrainingPanel({
  projectId,
  stepId,
  members,
  confirmed,
  canEdit,
  onSaved,
}: {
  projectId: string;
  stepId: string;
  members: Member[];
  confirmed?: ConfirmedTraining;
  canEdit: boolean;
  onSaved: (completionData: Record<string, unknown>) => void;
}) {
  const [rows, setRows] = useState([{ user_id: '', skills: '', training: '' }]);
  const [busy, setBusy] = useState(false);

  const valid = rows.filter(r => r.user_id && r.skills.trim());

  const confirm = async () => {
    if (valid.length === 0 || valid.length !== rows.length) {
      return toast.error('Fill in the name and the required knowledge and skills on every row');
    }
    setBusy(true);
    try {
      const step = await projectsApi.confirmTraining(projectId, stepId, {
        rows: valid.map(r => ({ user_id: r.user_id, skills: r.skills.trim(), training: r.training.trim() || undefined })),
      });
      onSaved((step.completion_data as Record<string, unknown>) ?? {});
      toast.success('Training needs confirmed; tasks created');
      setRows([{ user_id: '', skills: '', training: '' }]);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to confirm training'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Training</CardTitle>
        <CardDescription>
          Do you think some of your people will need new knowledge and skills to perform this step? List the names and the knowledge &amp; skills they need.
          If possible, add a concrete training to achieve those competences. Optional — skip it if nobody needs training.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {confirmed && (
          <div className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-800 dark:bg-green-900/20 dark:text-green-400 space-y-1">
            <p className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4" />Confirmed on {new Date(confirmed.confirmed_at).toLocaleDateString()}:</p>
            <ul className="list-disc pl-10">
              {confirmed.rows.map((r, i) => (
                <li key={i}>{memberName(members, r.user_id)} — {r.skills}{r.training ? ` (${r.training})` : ''}</li>
              ))}
            </ul>
          </div>
        )}

        {canEdit && (
          <>
            {rows.map((r, i) => (
              <div key={i} className="grid gap-2 sm:grid-cols-[1fr_1.5fr_1fr_auto] sm:items-end">
                <div>
                  <Label htmlFor={`tr-name-${i}`} className="text-xs">Name *</Label>
                  <NativeSelect id={`tr-name-${i}`} value={r.user_id}
                    onChange={(e) => setRows(prev => prev.map((x, j) => (j === i ? { ...x, user_id: e.target.value } : x)))}>
                    <option value="">Select a person</option>
                    {members.map(m => <option key={m.user_id} value={m.user_id}>{m.user.first_name} {m.user.last_name}</option>)}
                  </NativeSelect>
                </div>
                <div>
                  <Label htmlFor={`tr-skills-${i}`} className="text-xs">Required knowledge and skills *</Label>
                  <Input id={`tr-skills-${i}`} placeholder="e.g. ISO 27001 risk assessment" value={r.skills}
                    onChange={(e) => setRows(prev => prev.map((x, j) => (j === i ? { ...x, skills: e.target.value } : x)))} />
                </div>
                <div>
                  <Label htmlFor={`tr-course-${i}`} className="text-xs">Training</Label>
                  <Input id={`tr-course-${i}`} placeholder="Course name (optional)" value={r.training}
                    onChange={(e) => setRows(prev => prev.map((x, j) => (j === i ? { ...x, training: e.target.value } : x)))} />
                </div>
                <Button variant="ghost" size="icon" aria-label="Remove row" disabled={rows.length === 1}
                  onClick={() => setRows(prev => prev.filter((_, j) => j !== i))}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <div className="flex flex-wrap gap-2">
              <Button variant="ghost" size="sm" onClick={() => setRows(prev => [...prev, { user_id: '', skills: '', training: '' }])}>
                <Plus className="h-4 w-4 mr-1" />Add a person
              </Button>
              <Button onClick={confirm} disabled={busy}>
                {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Confirm
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
