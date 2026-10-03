'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AlertTriangle, ArrowRight, Building2, CalendarClock, FolderOpen, Inbox, ListTodo, Plus } from 'lucide-react';
import { ComplianceProject, projectsApi } from '@/lib/api';
import { notificationHref, notificationMessage, notificationContext, timeAgo } from '@/lib/notifications';
import { TASK_TYPE_COLORS, TASK_TYPE_LABELS, formatDay, isOpen, isOverdue, taskHref, taskSubject } from '@/lib/tasks';
import { useAuthStore } from '@/store/auth-store';
import { useInboxStore } from '@/store/inbox-store';
import { useOrgStore } from '@/store/org-store';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';

type ProjectWithOrg = ComplianceProject & { orgName: string };

const DAY = 24 * 60 * 60 * 1000;

/** Personal dashboard: everything shown comes from the user's own projects, tasks and notifications. */
export default function DashboardPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { organizations, loadOrganizations } = useOrgStore();
  const { myTasks, awaitingRequests, notifications, loaded: inboxLoaded } = useInboxStore();
  const [projects, setProjects] = useState<ProjectWithOrg[] | null>(null);

  useEffect(() => { void loadOrganizations(); }, [loadOrganizations]);

  useEffect(() => {
    let cancelled = false;
    void Promise.all(organizations.map(async (org) =>
      (await projectsApi.list(org.id).catch(() => [])).map((p) => ({ ...p, orgName: org.name })),
    )).then((lists) => { if (!cancelled) setProjects(lists.flat()); });
    return () => { cancelled = true; };
  }, [organizations]);

  const openTasks = useMemo(() => myTasks.filter(isOpen), [myTasks]);
  const overdue = openTasks.filter(isOverdue).length;
  const nextTasks = openTasks.slice(0, 5); // already sorted by deadline
  const upcoming = openTasks.filter((t) => t.deadline && new Date(t.deadline).getTime() < Date.now() + 30 * DAY);

  if (!projects || !inboxLoaded) {
    return (
      <div className="flex items-center justify-center" style={{ minHeight: '400px' }}>
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2" style={{ borderColor: 'var(--brand-orange)', borderTopColor: 'transparent' }} />
      </div>
    );
  }

  if (organizations.length === 0) {
    return (
      <div className="flex min-h-[calc(100vh-180px)] items-center justify-center">
        <div className="glass fade-up w-full max-w-xl p-10 text-center">
          <Building2 className="mx-auto mb-5 h-16 w-16" style={{ color: 'var(--brand-orange)', opacity: 0.55 }} />
          <h1 className="font-display mb-2 text-2xl font-semibold">Create your first organization</h1>
          <p className="mx-auto mb-6 max-w-md text-sm text-dim">
            Organizations are your secure workspaces. Create one or accept an invitation before starting a project.
          </p>
          <button className="btn-accent" onClick={() => router.push('/dashboard/organizations?create=true')}>
            <Plus className="h-4 w-4" />
            Create organization
          </button>
        </div>
      </div>
    );
  }

  const stats = [
    { icon: FolderOpen, value: projects.length, label: projects.length === 1 ? 'Project' : 'Projects', color: 'var(--success)', href: null },
    { icon: ListTodo, value: openTasks.length, label: 'Tasks to do', color: 'var(--brand-orange)', href: '/dashboard/tasks' },
    { icon: AlertTriangle, value: overdue, label: 'Overdue tasks', color: overdue ? 'var(--danger)' : 'var(--muted-foreground)', href: '/dashboard/tasks' },
    { icon: Inbox, value: awaitingRequests.length, label: 'Requests to decide', color: 'var(--warning)', href: null },
  ];

  return (
    <div>
      <div className="fade-up mb-7" style={{ animationDelay: '0.1s' }}>
        <h1 className="font-display text-[26px] font-bold mb-1">Welcome back, {user?.first_name || 'there'}</h1>
        <p className="text-[14.5px]" style={{ color: 'var(--muted-foreground)' }}>
          Where your ISO 27001 projects stand and what needs your attention.
        </p>
      </div>

      <div className="grid gap-[18px] mb-5 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat, i) => {
          const Icon = stat.icon;
          const body = (
            <>
              <div className="stat-icon" style={{ background: 'color-mix(in srgb, currentColor 12%, transparent)', color: stat.color }}>
                <Icon className="h-[18px] w-[18px]" />
              </div>
              <div className="font-mono-numeric text-[26px] font-semibold">{stat.value}</div>
              <div className="text-[13px]" style={{ color: 'var(--muted-foreground)' }}>{stat.label}</div>
            </>
          );
          const props = { className: 'glass glass-hover fade-up block', style: { animationDelay: `${0.15 + i * 0.05}s`, padding: 20 } };
          return stat.href ? <Link key={stat.label} href={stat.href} {...props}>{body}</Link> : <div key={stat.label} {...props}>{body}</div>;
        })}
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.5fr_1fr] items-start">
        <div className="flex flex-col gap-5">
          <Panel title="My projects" delay={0.35}>
            {projects.length === 0 ? (
              <p className="text-sm text-dim">No project yet. Open an organization to start an ISO 27001 project.</p>
            ) : projects.map((p) => {
              const inProgress = (p.phases ?? []).filter((ph) => ph.progress === 'IN_PROGRESS');
              return (
                <Link key={p.id} href={`/dashboard/organizations/${p.organization_id}/projects/${p.id}`} className="activity-row block">
                  <div className="flex-1 min-w-0 space-y-1.5">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-[13.5px] font-medium truncate">{p.name}</span>
                      <span className="font-mono-numeric text-[13px] shrink-0">{p.progress?.percent ?? 0}%</span>
                    </div>
                    <Progress value={p.progress?.percent ?? 0} className="h-1.5" />
                    <div className="text-[11.5px] text-dim">
                      {p.orgName} · {p.progress?.completed_steps ?? 0} of {p.progress?.total_steps ?? 0} steps completed
                      {inProgress.length > 0 && ` · in progress: ${inProgress.map((ph) => `Phase ${ph.order}`).join(', ')}`}
                    </div>
                  </div>
                </Link>
              );
            })}
          </Panel>

          <Panel title="Recent activity" delay={0.4}>
            {notifications.length === 0 ? (
              <p className="text-sm text-dim">Nothing yet. Assignments, completed tasks and decisions appear here.</p>
            ) : notifications.slice(0, 6).map((n) => {
              const href = notificationHref(n);
              const body = (
                <div className="flex-1 min-w-0">
                  <div className="text-[13.5px]">{notificationMessage(n)}</div>
                  <div className="text-[11.5px] text-dim">{notificationContext(n)} · {timeAgo(n.created_at)}</div>
                </div>
              );
              return href
                ? <Link key={n.id} href={href} className="activity-row">{body}</Link>
                : <div key={n.id} className="activity-row">{body}</div>;
            })}
          </Panel>
        </div>

        <div className="flex flex-col gap-5">
          <Panel title="My next tasks" delay={0.35} action={{ label: 'All tasks', href: '/dashboard/tasks' }}>
            {nextTasks.length === 0 ? (
              <p className="text-sm text-dim">Nothing to do right now.</p>
            ) : nextTasks.map((t) => (
              <Link key={t.id} href={taskHref(t)} className="activity-row">
                <div className="flex-1 min-w-0 space-y-1">
                  <Badge className={TASK_TYPE_COLORS[t.type]}>{TASK_TYPE_LABELS[t.type]}</Badge>
                  <div className="text-[13px] truncate">{taskSubject(t)}</div>
                  {t.deadline && (
                    <div className={`text-[11.5px] ${isOverdue(t) ? 'font-semibold text-red-600 dark:text-red-400' : 'text-dim'}`}>
                      {isOverdue(t) ? 'Overdue since' : 'Due'} {formatDay(t.deadline)}
                    </div>
                  )}
                </div>
              </Link>
            ))}
          </Panel>

          <Panel title="Deadlines in the next 30 days" delay={0.4}>
            {upcoming.length === 0 ? (
              <p className="text-sm text-dim">No deadline in the next 30 days.</p>
            ) : upcoming.map((t) => {
              const d = new Date(t.deadline!);
              return (
                <Link key={t.id} href={taskHref(t)} className="activity-row">
                  <div className="w-11 shrink-0 text-center">
                    <div className="font-mono-numeric text-[18px] font-semibold leading-none">{d.getDate()}</div>
                    <div className="text-[10.5px] uppercase text-dim">{d.toLocaleDateString('en-GB', { month: 'short' })}</div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] truncate">{TASK_TYPE_LABELS[t.type]}: {taskSubject(t)}</div>
                    <div className="text-[11.5px] text-dim flex items-center gap-1"><CalendarClock className="h-3 w-3" />{t.project.name}</div>
                  </div>
                </Link>
              );
            })}
          </Panel>
        </div>
      </div>
    </div>
  );
}

function Panel({ title, delay, action, children }: {
  title: string;
  delay: number;
  action?: { label: string; href: string };
  children: React.ReactNode;
}) {
  return (
    <div className="glass fade-up" style={{ animationDelay: `${delay}s`, padding: 24 }}>
      <div className="flex items-center justify-between mb-1.5">
        <div className="font-display text-[16px] font-semibold">{title}</div>
        {action && (
          <Link href={action.href} className="text-[13px] font-semibold flex items-center gap-1" style={{ color: 'var(--brand-orange)' }}>
            {action.label}<ArrowRight className="h-3.5 w-3.5" />
          </Link>
        )}
      </div>
      {children}
    </div>
  );
}
