'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { CalendarClock, RefreshCw } from 'lucide-react';
import apiClient from '@/lib/api-client';
import type { RiskRegisterCompletion } from '@/lib/api';
import type { Frequency } from '@/lib/audit-prep-api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { Spinner } from '@/components/ui/spinner';
import { ReadOnlyNotice, dateValue, fmtDate, useRegister } from '@/components/audit-prep/shared';
import { FREQUENCIES } from '@/components/audit-prep/objectives';

type ActivityStatus = 'NOT_STARTED' | 'ON_TIME' | 'DUE_SOON' | 'LATE';

interface MaintenanceState {
  setup: {
    certification_date: string | null;
    certification_body: string | null;
    certificate_number: string | null;
    incident_review_frequency: Frequency;
    training_review_frequency: Frequency;
    last_run_at: string | null;
  };
  dates: {
    certification_date: string | null;
    next_surveillance_audit: string | null;
    next_recertification: string | null;
    next_internal_audit: string | null;
    cycle: { label: string; date: string }[];
  };
  activities: {
    key: string;
    title: string;
    description: string;
    step_id: string | null;
    next_scheduled: string | null;
    status: ActivityStatus;
    items: number;
    open_tasks: number;
    completed_tasks: number;
  }[];
  completion: RiskRegisterCompletion;
  permissions: { canEdit: boolean; canDecide: boolean; userId: string };
  created?: number;
}

const maintenanceApi = {
  get: async (p: string) => (await apiClient.get(`/projects/${p}/maintenance`)).data as MaintenanceState,
  update: async (p: string, d: Record<string, unknown>) => (await apiClient.put(`/projects/${p}/maintenance`, d)).data as MaintenanceState,
  run: async (p: string) => (await apiClient.post(`/projects/${p}/maintenance/run`)).data as MaintenanceState,
};

const STATUS: Record<ActivityStatus, [string, string]> = {
  NOT_STARTED: ['Not started', 'bg-muted text-muted-foreground'],
  ON_TIME: ['On time', 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'],
  DUE_SOON: ['Due soon', 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400'],
  LATE: ['Late', 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'],
};

/** Phase 5: ISMS Maintenance & Certification Cycle (Conformio "Maintenance" module). */
export default function Maintenance({ orgId, projectId, onCompletionChange }: {
  orgId: string;
  projectId: string;
  onCompletionChange?: (c: RiskRegisterCompletion) => void;
}) {
  const load = useCallback(() => maintenanceApi.get(projectId), [projectId]);
  const { state, loading, run } = useRegister<MaintenanceState>(load, onCompletionChange);
  const [editing, setEditing] = useState(false);
  const [f, setF] = useState({ certification_date: '', certification_body: '', certificate_number: '', incident_review_frequency: 'QUARTERLY' as Frequency, training_review_frequency: 'YEARLY' as Frequency });

  useEffect(() => {
    if (state) {
      setF({
        certification_date: dateValue(state.setup.certification_date),
        certification_body: state.setup.certification_body ?? '',
        certificate_number: state.setup.certificate_number ?? '',
        incident_review_frequency: state.setup.incident_review_frequency,
        training_review_frequency: state.setup.training_review_frequency,
      });
    }
  }, [state]);

  if (loading) return <div className="flex justify-center py-16"><Spinner className="h-6 w-6" /></div>;
  if (!state) return <p className="text-sm text-muted-foreground">Unable to load the maintenance module.</p>;
  const { dates, permissions } = state;
  const stepHref = (id: string) => `/dashboard/organizations/${orgId}/projects/${projectId}/steps/${id}`;

  return (
    <div className="space-y-4">
      <ReadOnlyNotice show={!permissions.canEdit} />

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><CalendarClock className="h-4 w-4" />Certification cycle</CardTitle>
          <CardDescription>
            A certificate is valid for 3 years, with a surveillance audit by the certification body after the first and second year, then a re-certification audit.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
            {([
              ['Certification achieved', fmtDate(dates.certification_date)],
              ['Next mandatory internal audit', fmtDate(dates.next_internal_audit)],
              ['Next surveillance audit', fmtDate(dates.next_surveillance_audit)],
              ['Next re-certification', fmtDate(dates.next_recertification)],
            ] as const).map(([label, value]) => (
              <div key={label} className="rounded-lg border border-border/60 bg-card px-3 py-2">
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className="text-lg font-semibold tabular-nums">{value === '—' ? 'N/A' : value}</p>
              </div>
            ))}
          </div>
          {state.setup.certification_body && (
            <p className="text-xs text-muted-foreground">
              Certification body: {state.setup.certification_body}{state.setup.certificate_number && ` · certificate ${state.setup.certificate_number}`}
            </p>
          )}

          {permissions.canDecide && !editing && <Button size="sm" variant="outline" onClick={() => setEditing(true)}>Update dates</Button>}
          {editing && (
            <div className="rounded-lg border p-3 space-y-3">
              <div className="grid gap-3 sm:grid-cols-3">
                <div><Label htmlFor="mt-cert" className="text-xs">Certification date</Label>
                  <Input id="mt-cert" type="date" value={f.certification_date} onChange={(e) => setF({ ...f, certification_date: e.target.value })} /></div>
                <div><Label htmlFor="mt-body" className="text-xs">Certification body</Label>
                  <Input id="mt-body" value={f.certification_body} onChange={(e) => setF({ ...f, certification_body: e.target.value })} /></div>
                <div><Label htmlFor="mt-num" className="text-xs">Certificate number</Label>
                  <Input id="mt-num" value={f.certificate_number} onChange={(e) => setF({ ...f, certificate_number: e.target.value })} /></div>
                <div><Label htmlFor="mt-inc" className="text-xs">Review of incidents</Label>
                  <NativeSelect id="mt-inc" value={f.incident_review_frequency} onChange={(e) => setF({ ...f, incident_review_frequency: e.target.value as Frequency })}>
                    {Object.entries(FREQUENCIES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </NativeSelect></div>
                <div><Label htmlFor="mt-tr" className="text-xs">Review of security trainings</Label>
                  <NativeSelect id="mt-tr" value={f.training_review_frequency} onChange={(e) => setF({ ...f, training_review_frequency: e.target.value as Frequency })}>
                    {Object.entries(FREQUENCIES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </NativeSelect></div>
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={async () => {
                  if (await run(() => maintenanceApi.update(projectId, { ...f, certification_date: f.certification_date || null }), 'Dates updated')) setEditing(false);
                }}>Save</Button>
                <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>Cancel</Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Continuous activities</CardTitle>
          <CardDescription className="max-w-3xl leading-relaxed">
            These activities must be performed throughout the year. When one is due, a task is created automatically for the responsible person —
            every night, and whenever this page is opened. Completing the task schedules the next one.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="py-2 pr-3 font-medium">Activity</th>
                  <th className="py-2 pr-3 font-medium">Next scheduled</th>
                  <th className="py-2 pr-3 font-medium">Status</th>
                  <th className="py-2 pr-3 font-medium text-right">Open tasks</th>
                  <th className="py-2 pr-3 font-medium text-right">Completed tasks</th>
                  <th className="py-2 font-medium"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {state.activities.map(a => (
                  <tr key={a.key} className="border-b border-border/40 align-top">
                    <td className="py-2.5 pr-3">
                      <p className="font-medium">{a.title}</p>
                      <p className="text-xs text-muted-foreground max-w-md">{a.description}</p>
                    </td>
                    <td className="py-2.5 pr-3 tabular-nums">{fmtDate(a.next_scheduled)}{a.items > 1 && <span className="block text-xs text-muted-foreground">earliest of {a.items}</span>}</td>
                    <td className="py-2.5 pr-3"><Badge className={STATUS[a.status][1]}>{STATUS[a.status][0]}</Badge></td>
                    <td className="py-2.5 pr-3 text-right tabular-nums">{a.open_tasks}</td>
                    <td className="py-2.5 pr-3 text-right tabular-nums">{a.completed_tasks}</td>
                    <td className="py-2.5">
                      {a.step_id && <Link href={stepHref(a.step_id)} className="text-xs text-[var(--brand-orange)] hover:underline">Open</Link>}
                      {a.key === 'incidents' && <Link href={`/dashboard/organizations/${orgId}/projects/${projectId}/registers`} className="text-xs text-[var(--brand-orange)] hover:underline">Open</Link>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">
              Last check: {state.setup.last_run_at ? new Date(state.setup.last_run_at).toLocaleString() : 'never'} ·{' '}
              <Link href="/dashboard/tasks" className="text-[var(--brand-orange)] hover:underline">My tasks</Link>
            </p>
            {permissions.canEdit && (
              <Button size="sm" variant="outline" onClick={() => run(() => maintenanceApi.run(projectId), 'Activities checked')}>
                <RefreshCw className="h-4 w-4 mr-1" />Check now
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
