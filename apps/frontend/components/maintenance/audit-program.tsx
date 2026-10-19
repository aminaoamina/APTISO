'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ClipboardList, Play, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import apiClient from '@/lib/api-client';
import { getErrorMessage } from '@/lib/utils';
import type { Member } from '@/lib/audit-prep-api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { BlurField, PersonSelect, fmtDate, nameOf } from '@/components/audit-prep/shared';
import { ExcelButton } from '@/components/exports/export-buttons';

type LineStatus = 'PLANNED' | 'LATE' | 'IN_PROGRESS' | 'DONE';

export interface AuditProgramState {
  period_start: string;
  period_end: string;
  objectives: string;
  criteria: string;
  methods: string;
  audits: {
    id: string;
    planned_month: string;
    auditor_id: string;
    scope: string;
    status: LineStatus;
    internal_audit: { id: string; title: string } | null;
  }[];
}

export const programApi = {
  update: async <T,>(p: string, d: Record<string, string>) => (await apiClient.put(`/projects/${p}/maintenance/program`, d)).data as T,
  add: async <T,>(p: string, d: Record<string, string>) => (await apiClient.post(`/projects/${p}/maintenance/program/audits`, d)).data as T,
  change: async <T,>(p: string, id: string, d: Record<string, string>) => (await apiClient.patch(`/projects/${p}/maintenance/program/audits/${id}`, d)).data as T,
  remove: async <T,>(p: string, id: string) => (await apiClient.delete(`/projects/${p}/maintenance/program/audits/${id}`)).data as T,
  start: async (p: string, id: string) => (await apiClient.post(`/projects/${p}/maintenance/program/audits/${id}/start`)).data as { audit_id: string; step_id: string },
  document: async <T,>(p: string) => (await apiClient.post(`/projects/${p}/maintenance/program/document`)).data as T,
};

const STATUS: Record<LineStatus, [string, string]> = {
  PLANNED: ['Planned', 'bg-muted text-muted-foreground'],
  LATE: ['Late', 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'],
  IN_PROGRESS: ['In progress', 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400'],
  DONE: ['Done', 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'],
};

const monthValue = (d: string) => d.slice(0, 7);
const monthLabel = (d: string) => new Date(d).toLocaleDateString(undefined, { month: 'long', year: 'numeric', timeZone: 'UTC' });

/** Clause 9.2.2: the internal audits planned over the certification cycle. */
export function AuditProgram<T extends object>({ orgId, projectId, program, members, canEdit, run }: {
  orgId: string;
  projectId: string;
  program: AuditProgramState | null;
  members: Member[];
  canEdit: boolean;
  run: (fn: () => Promise<T>, success?: string) => Promise<boolean>;
}) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [f, setF] = useState({ planned_month: '', auditor_id: '', scope: '' });

  if (!program) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><ClipboardList className="h-4 w-4" />Internal audit program</CardTitle>
          <CardDescription>Record the certification date above: the program plans the internal audits of the 3-year certification cycle.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const start = async (id: string) => {
    try {
      const { step_id } = await programApi.start(projectId, id);
      toast.success('Audit scheduled with its checklist');
      router.push(`/dashboard/organizations/${orgId}/projects/${projectId}/steps/${step_id}`);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Action failed'));
    }
  };
  const text = (key: 'objectives' | 'criteria' | 'methods', label: string) => (
    <div>
      <Label htmlFor={`ap-${key}`} className="text-xs">{label}</Label>
      <BlurField id={`ap-${key}`} multiline value={program[key]} disabled={!canEdit}
        onSave={(v) => run(() => programApi.update<T>(projectId, { [key]: v }), 'Program updated')} />
    </div>
  );

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-base flex items-center gap-2"><ClipboardList className="h-4 w-4" />Internal audit program</CardTitle>
          <ExcelButton projectId={projectId} register="audit-program" />
        </div>
        <CardDescription className="max-w-3xl leading-relaxed">
          The internal audits planned for the certification cycle {fmtDate(program.period_start)} – {fmtDate(program.period_end)} (clause 9.2.2).
          Each audit covers the whole ISMS by default; start it when it is due to schedule it with its checklist. Changes to the plan need a new approval of the program document.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 lg:grid-cols-3">
          {text('objectives', 'Objectives')}
          {text('criteria', 'Criteria')}
          {text('methods', 'Methods')}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th className="py-2 pr-3 font-medium">Planned month</th>
                <th className="py-2 pr-3 font-medium">Scope</th>
                <th className="py-2 pr-3 font-medium">Auditor</th>
                <th className="py-2 pr-3 font-medium">Status</th>
                <th className="py-2 font-medium"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {program.audits.map(a => {
                const editable = canEdit && !a.internal_audit;
                return (
                  <tr key={a.id} className="border-b border-border/40 align-top">
                    <td className="py-2 pr-3 w-40">
                      {editable
                        ? <Input type="month" aria-label="Planned month" value={monthValue(a.planned_month)}
                            onChange={(e) => e.target.value && run(() => programApi.change<T>(projectId, a.id, { planned_month: `${e.target.value}-01` }))} />
                        : monthLabel(a.planned_month)}
                    </td>
                    <td className="py-2 pr-3 min-w-64">
                      {editable
                        ? <BlurField value={a.scope} onSave={(v) => run(() => programApi.change<T>(projectId, a.id, { scope: v }), 'Scope updated')} />
                        : <span className="text-xs">{a.scope}</span>}
                    </td>
                    <td className="py-2 pr-3 w-48">
                      {editable
                        ? <PersonSelect members={members} value={a.auditor_id} placeholder="Select the auditor"
                            onChange={(v) => v && run(() => programApi.change<T>(projectId, a.id, { auditor_id: v }), 'Auditor updated')} />
                        : nameOf(members, a.auditor_id)}
                    </td>
                    <td className="py-2 pr-3">
                      <Badge className={STATUS[a.status][1]}>{STATUS[a.status][0]}</Badge>
                      {a.internal_audit && <span className="block text-xs text-muted-foreground mt-1">{a.internal_audit.title}</span>}
                    </td>
                    <td className="py-2 whitespace-nowrap">
                      {editable && (
                        <div className="flex gap-1">
                          <Button size="sm" variant="outline" onClick={() => start(a.id)}><Play className="h-3.5 w-3.5 mr-1" />Start audit</Button>
                          <Button size="sm" variant="ghost" aria-label="Remove" onClick={() => run(() => programApi.remove<T>(projectId, a.id), 'Planned audit removed')}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {canEdit && !adding && <Button size="sm" variant="outline" onClick={() => setAdding(true)}><Plus className="h-4 w-4 mr-1" />Plan an audit</Button>}
        {adding && (
          <div className="rounded-lg border p-3 space-y-3">
            <div className="grid gap-3 sm:grid-cols-3">
              <div><Label htmlFor="ap-month" className="text-xs">Planned month</Label>
                <Input id="ap-month" type="month" value={f.planned_month} onChange={(e) => setF({ ...f, planned_month: e.target.value })} /></div>
              <div><Label htmlFor="ap-auditor" className="text-xs">Auditor</Label>
                <PersonSelect id="ap-auditor" members={members} value={f.auditor_id || null} placeholder="Select the auditor" onChange={(v) => setF({ ...f, auditor_id: v ?? '' })} /></div>
              <div><Label htmlFor="ap-scope" className="text-xs">Scope</Label>
                <Input id="ap-scope" value={f.scope} placeholder="The entire ISMS" onChange={(e) => setF({ ...f, scope: e.target.value })} /></div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" disabled={!f.planned_month || !f.auditor_id} onClick={async () => {
                if (await run(() => programApi.add<T>(projectId, { ...f, planned_month: `${f.planned_month}-01` }), 'Audit planned')) {
                  setAdding(false);
                  setF({ planned_month: '', auditor_id: '', scope: '' });
                }
              }}>Save</Button>
              <Button size="sm" variant="ghost" onClick={() => setAdding(false)}>Cancel</Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
