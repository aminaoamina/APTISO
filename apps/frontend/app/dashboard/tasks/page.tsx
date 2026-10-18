'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { AlertTriangle, CalendarClock, CheckCircle2, ExternalLink, FolderOpen, ListTodo, Loader2, UserRound, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { ProjectMember, projectsApi, TaskAssignment, tasksApi } from '@/lib/api';
import { formatDay, fullName, isOpen, isOverdue, MANUAL_TASK_TYPES, TASK_TYPE_COLORS, TASK_TYPE_LABELS, taskHref, taskSubject } from '@/lib/tasks';
import { getErrorMessage } from '@/lib/utils';
import { useInboxStore } from '@/store/inbox-store';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import { Spinner } from '@/components/ui/spinner';
import { Textarea } from '@/components/ui/textarea';
import { EvidencePanel } from '@/components/evidence/evidence-panel';

type View = 'todo' | 'done' | 'team';

const STATUS_LABELS: Record<TaskAssignment['status'], string> = {
  PENDING: 'To do', IN_PROGRESS: 'In progress', COMPLETED: 'Done', CANCELLED: 'Cancelled',
};

export default function TasksPage() {
  return (
    <Suspense fallback={<div className="flex justify-center py-16"><Spinner className="h-6 w-6" /></div>}>
      <TasksView />
    </Suspense>
  );
}

function TasksView() {
  const highlight = useSearchParams().get('task');
  const { myTasks, loaded, refresh } = useInboxStore();
  const [view, setView] = useState<View>('todo');
  const [team, setTeam] = useState<TaskAssignment[] | null>(null);

  useEffect(() => { void tasksApi.team().then(setTeam).catch(() => setTeam([])); }, []);

  // A link from an e-mail or a notification scrolls to its task.
  useEffect(() => {
    if (!highlight || !loaded) return;
    if (myTasks.some((t) => t.id === highlight && !isOpen(t))) setView('done');
    setTimeout(() => document.getElementById(`task-${highlight}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 100);
  }, [highlight, loaded, myTasks]);

  const todo = useMemo(() => myTasks.filter(isOpen), [myTasks]);
  const done = useMemo(() => myTasks.filter((t) => t.status === 'COMPLETED').sort((a, b) => (b.completed_at ?? '').localeCompare(a.completed_at ?? '')), [myTasks]);
  const overdue = todo.filter(isOverdue).length;

  const reloadTeam = () => tasksApi.team().then(setTeam);

  if (!loaded) {
    return <div className="flex justify-center py-16"><Spinner className="h-6 w-6" /></div>;
  }

  const tabs: { key: View; label: string; count: number }[] = [
    { key: 'todo', label: 'To do', count: todo.length },
    { key: 'done', label: 'Done', count: done.length },
    ...(team?.length ? [{ key: 'team' as const, label: 'Team', count: team.filter(isOpen).length }] : []),
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2.5">
          <ListTodo className="h-6 w-6 text-primary" />
          My tasks
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          What you need to do across all your projects. Open a task to go where the work is done.
        </p>
      </div>

      {overdue > 0 && view === 'todo' && (
        <div className="flex items-center gap-2 rounded-lg border border-red-300 bg-red-50 px-4 py-2.5 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          <AlertTriangle className="h-4 w-4" />
          {overdue} task{overdue > 1 ? 's are' : ' is'} past the deadline.
        </div>
      )}

      <div className="flex gap-1 border-b">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setView(t.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${view === t.key ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
          >
            {t.label} <span className="ml-1 text-xs text-muted-foreground">{t.count}</span>
          </button>
        ))}
      </div>

      {view === 'team' ? (
        <TaskList tasks={team ?? []} empty="No tasks assigned by you or in projects you lead." render={(t) => (
          <TeamTaskCard key={t.id} task={t} onChanged={reloadTeam} />
        )} />
      ) : (
        <TaskList
          tasks={view === 'todo' ? todo : done}
          empty={view === 'todo' ? 'Nothing to do. Tasks appear here when someone assigns you work.' : 'No completed tasks yet.'}
          render={(t) => <MyTaskCard key={t.id} task={t} highlighted={t.id === highlight} onCompleted={refresh} />}
        />
      )}
    </div>
  );
}

function TaskList({ tasks, empty, render }: { tasks: TaskAssignment[]; empty: string; render: (t: TaskAssignment) => React.ReactNode }) {
  if (!tasks.length) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-12 text-center text-sm text-muted-foreground">{empty}</CardContent>
      </Card>
    );
  }
  return <div className="space-y-3">{tasks.map(render)}</div>;
}

/** Type, subject, project, who assigned it and when it is due — shared by both views. */
function TaskSummary({ task, person }: { task: TaskAssignment; person: { label: string; name: string } }) {
  const late = isOverdue(task);
  return (
    <div className="min-w-0 flex-1 space-y-1.5">
      <div className="flex flex-wrap items-center gap-2">
        <Badge className={TASK_TYPE_COLORS[task.type]}>{TASK_TYPE_LABELS[task.type]}</Badge>
        <span className="text-sm font-semibold">{taskSubject(task)}</span>
      </div>
      <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
        <span className="flex items-center gap-1"><FolderOpen className="h-3 w-3" />{task.project.name}</span>
        <span className="flex items-center gap-1"><UserRound className="h-3 w-3" />{person.label} {person.name} on {formatDay(task.created_at)}</span>
        {task.deadline && (
          <span className={`flex items-center gap-1 ${late ? 'font-semibold text-red-600 dark:text-red-400' : ''}`}>
            <CalendarClock className="h-3 w-3" />{late ? 'Overdue since' : 'Due'} {formatDay(task.deadline)}
          </span>
        )}
      </p>
      {task.notes && <p className="whitespace-pre-line text-sm text-muted-foreground line-clamp-6">{task.notes}</p>}
      {task.completion_notes && (
        <p className="text-sm"><span className="text-muted-foreground">Done on {task.completed_at && formatDay(task.completed_at)}: </span>{task.completion_notes}</p>
      )}
    </div>
  );
}

function MyTaskCard({ task, highlighted, onCompleted }: { task: TaskAssignment; highlighted: boolean; onCompleted: () => Promise<void> }) {
  const [completing, setCompleting] = useState(false);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  const complete = async () => {
    setSaving(true);
    try {
      await tasksApi.complete(task.id, note || undefined);
      toast.success('Task completed');
      await onCompleted();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to complete the task'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card id={`task-${task.id}`} className={highlighted ? 'ring-2 ring-primary' : ''}>
      <CardContent className="py-4 space-y-3">
        <div className="flex items-start gap-3">
          <TaskSummary task={task} person={{ label: 'Assigned by', name: fullName(task.assigner) }} />
          <div className="flex shrink-0 gap-2">
            <Button size="sm" variant="outline" asChild>
              <Link href={taskHref(task)}><ExternalLink className="h-4 w-4 mr-1.5" />Open</Link>
            </Button>
            {isOpen(task) && !completing && (
              <Button size="sm" onClick={() => setCompleting(true)}><CheckCircle2 className="h-4 w-4 mr-1.5" />Complete</Button>
            )}
          </div>
        </div>
        {completing && (
          <div className="space-y-2 rounded-lg border p-3">
            <EvidencePanel projectId={task.project_id} target={{ type: 'TASK', id: task.id }} canEdit
              hint={task.type === 'IMPLEMENT_CONTROL'
                ? 'Attach proof that the control is in place; it is also linked to the control in the Statement of Applicability.'
                : 'Attach proof of what you did (optional).'} />
            <Textarea
              rows={2}
              maxLength={2000}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="What did you do? (optional, kept with the task as a record)"
            />
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="ghost" onClick={() => setCompleting(false)}>Cancel</Button>
              <Button size="sm" onClick={complete} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-1.5" />}
                Mark as done
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/** A task handed out to someone else: hand-assigned tasks can be reassigned, rescheduled or cancelled. */
function TeamTaskCard({ task, onChanged }: { task: TaskAssignment; onChanged: () => Promise<unknown> }) {
  const [editing, setEditing] = useState(false);
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [assignee, setAssignee] = useState(task.assigned_to);
  const [deadline, setDeadline] = useState(task.deadline?.slice(0, 10) ?? '');
  const [busy, setBusy] = useState(false);
  const manageable = isOpen(task) && MANUAL_TASK_TYPES.includes(task.type);

  const startEditing = async () => {
    setEditing(true);
    if (!members.length) {
      const project = await projectsApi.getOne(task.project_id);
      setMembers(project.members ?? []);
    }
  };

  const run = async (action: () => Promise<unknown>, success: string) => {
    setBusy(true);
    try {
      await action();
      toast.success(success);
      setEditing(false);
      await onChanged();
    } catch (err) {
      toast.error(getErrorMessage(err, 'The task could not be changed'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardContent className="py-4 space-y-3">
        <div className="flex items-start gap-3">
          <TaskSummary task={task} person={{ label: 'Assigned to', name: fullName(task.assignee) }} />
          <div className="flex shrink-0 flex-col items-end gap-2">
            <Badge variant="outline">{STATUS_LABELS[task.status]}</Badge>
            {manageable && !editing && <Button size="sm" variant="outline" onClick={startEditing}>Change</Button>}
          </div>
        </div>
        {!manageable && isOpen(task) && (
          <p className="text-xs text-muted-foreground">This task follows its register record; change it from there.</p>
        )}
        {editing && (
          <div className="grid gap-3 rounded-lg border p-3 sm:grid-cols-[1fr_180px_auto] sm:items-end">
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">Assigned to</label>
              <NativeSelect value={assignee} onChange={(e) => setAssignee(e.target.value)}>
                {members.map((m) => <option key={m.user_id} value={m.user_id}>{fullName(m.user)}</option>)}
              </NativeSelect>
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">Deadline</label>
              <Input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
            </div>
            <div className="flex gap-2">
              <Button size="sm" disabled={busy} onClick={() => run(() => tasksApi.update(task.id, {
                ...(assignee !== task.assigned_to && { assigned_to: assignee }),
                deadline: deadline || null,
              }), 'Task updated')}>Save</Button>
              <Button size="sm" variant="ghost" disabled={busy} onClick={() => setEditing(false)}>Close</Button>
              <Button size="sm" variant="ghost" className="text-destructive" disabled={busy} onClick={() => {
                if (window.confirm('Cancel this task? The assignee is told it was removed.')) void run(() => tasksApi.cancel(task.id), 'Task cancelled');
              }}><XCircle className="h-4 w-4 mr-1" />Cancel task</Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
