'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { AlertTriangle, ChevronDown, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import apiClient from '@/lib/api-client';
import { getErrorMessage } from '@/lib/utils';
import { ISO_ROLE_LABELS, PRIVILEGE_LABELS } from '@/lib/roles';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Spinner } from '@/components/ui/spinner';

interface Person {
  user_id: string;
  name: string;
  email: string;
  privilege: string;
  job_title: string | null;
  iso_roles: string[];
  open: number;
  overdue: number;
  due_this_week: number;
  done_30_days: number;
  tasks: { id: string; title: string; deadline: string | null; overdue: boolean; document_id: string | null; step_id: string | null }[];
}

interface Team {
  people: Person[];
  totals: { members: number; open: number; overdue: number; done_30_days: number };
  gaps: { role: string; label: string; why: string }[];
}

/** Members dashboard: who does what, and who is behind. Read-only; members are managed on the Project members page. */
export default function TeamPage() {
  const { orgId, projectId } = useParams<{ orgId: string; projectId: string }>();
  const [team, setTeam] = useState<Team | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const base = `/dashboard/organizations/${orgId}/projects/${projectId}`;

  useEffect(() => {
    apiClient.get<Team>(`/projects/${projectId}/team`)
      .then((r) => setTeam(r.data))
      .catch((err) => toast.error(getErrorMessage(err, 'The team could not be loaded')));
  }, [projectId]);

  if (!team) return <div className="flex justify-center py-16"><Spinner className="h-6 w-6" /></div>;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Team</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Each member&apos;s workload and ISO roles. To invite people or change roles, use{' '}
          <Link href={`${base}/members`} className="text-[var(--brand-orange)] hover:underline">Project members</Link>.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {([
          ['Members', team.totals.members],
          ['Open tasks', team.totals.open],
          ['Overdue', team.totals.overdue],
          ['Done in 30 days', team.totals.done_30_days],
        ] as const).map(([label, value]) => (
          <Card key={label}><CardContent className="py-4">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className={`text-2xl font-semibold tabular-nums ${label === 'Overdue' && value > 0 ? 'text-destructive' : ''}`}>{value}</p>
          </CardContent></Card>
        ))}
      </div>

      {team.gaps.length > 0 && (
        <Card className="border-amber-300 dark:border-amber-800">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-amber-600" />ISO roles nobody holds yet</CardTitle>
            <CardDescription>A certification auditor expects these roles to be assigned. Assign them on the Project members page.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            {team.gaps.map((g) => <p key={g.role}><span className="font-medium">{g.label}</span>: {g.why}</p>)}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th className="px-4 py-2.5 font-medium">Member</th>
                <th className="px-4 py-2.5 font-medium">Roles</th>
                <th className="px-4 py-2.5 font-medium text-right">Open</th>
                <th className="px-4 py-2.5 font-medium text-right">Overdue</th>
                <th className="px-4 py-2.5 font-medium text-right">Due in 7 days</th>
                <th className="px-4 py-2.5 font-medium text-right">Done (30 days)</th>
              </tr>
            </thead>
            <tbody>
              {team.people.map((p) => (
                <FragmentRow key={p.user_id} person={p} base={base} open={open === p.user_id} onToggle={() => setOpen(open === p.user_id ? null : p.user_id)} />
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}

function FragmentRow({ person: p, base, open, onToggle }: { person: Person; base: string; open: boolean; onToggle: () => void }) {
  return (
    <>
      <tr className="border-b border-border/40 align-top hover:bg-muted/30 cursor-pointer" onClick={onToggle}>
        <td className="px-4 py-3">
          <p className="font-medium flex items-center gap-1">
            {p.open > 0 ? (open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />) : <span className="w-3.5" />}
            {p.name}
          </p>
          <p className="text-xs text-muted-foreground pl-[18px]">{p.job_title || p.email}</p>
        </td>
        <td className="px-4 py-3">
          <div className="flex flex-wrap gap-1">
            <Badge variant="outline" className="text-xs">{PRIVILEGE_LABELS[p.privilege] ?? p.privilege}</Badge>
            {p.iso_roles.map((r) => <Badge key={r} className="text-xs bg-muted text-foreground">{ISO_ROLE_LABELS[r] ?? r}</Badge>)}
          </div>
        </td>
        <td className="px-4 py-3 text-right tabular-nums">{p.open}</td>
        <td className={`px-4 py-3 text-right tabular-nums ${p.overdue ? 'text-destructive font-semibold' : ''}`}>{p.overdue}</td>
        <td className="px-4 py-3 text-right tabular-nums">{p.due_this_week}</td>
        <td className="px-4 py-3 text-right tabular-nums">{p.done_30_days}</td>
      </tr>
      {open && p.tasks.length > 0 && (
        <tr className="border-b border-border/40 bg-muted/20">
          <td colSpan={6} className="px-4 py-2">
            <ul className="space-y-1 pl-[18px]">
              {p.tasks.map((t) => {
                const href = t.document_id ? `${base}/documents/${t.document_id}` : t.step_id ? `${base}/steps/${t.step_id}` : null;
                const label = <>{t.title}{t.deadline && <span className={t.overdue ? 'text-destructive' : 'text-muted-foreground'}> · due {new Date(t.deadline).toLocaleDateString()}{t.overdue && ' (overdue)'}</span>}</>;
                return <li key={t.id} className="text-xs">{href ? <Link href={href} className="hover:underline">{label}</Link> : label}</li>;
              })}
            </ul>
          </td>
        </tr>
      )}
    </>
  );
}
