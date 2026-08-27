'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  CheckCircle2,
  Clock,
  FolderOpen,
  ListTodo,
  Loader2,
  ExternalLink,
} from 'lucide-react';
import { tasksApi, TaskAssignment } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Spinner } from '@/components/ui/spinner';
import { toast } from 'sonner';
import { getErrorMessage } from '@/lib/utils';

const TASK_TYPE_LABELS: Record<string, string> = {
  WORK_ON_DOCUMENT: 'Write document',
  REVIEW_DOCUMENT: 'Review document',
  APPROVE_DOCUMENT: 'Approve document',
  AWARENESS_TASK: 'Awareness',
  TRAINING_TASK: 'Training',
  HR_REQUEST: 'HR request',
  FINANCE_REQUEST: 'Finance request',
  TECHNOLOGY_REQUEST: 'Technology request',
};

const TASK_TYPE_COLORS: Record<string, string> = {
  WORK_ON_DOCUMENT: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  REVIEW_DOCUMENT: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
  APPROVE_DOCUMENT: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  AWARENESS_TASK: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
  TRAINING_TASK: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400',
  HR_REQUEST: 'bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-400',
  FINANCE_REQUEST: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
  TECHNOLOGY_REQUEST: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-400',
};

export default function MyTasksPage() {
  const [tasks, setTasks] = useState<TaskAssignment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [completingId, setCompletingId] = useState<string | null>(null);

  const loadTasks = useCallback(async () => {
    try {
      const data = await tasksApi.getMyTasks();
      setTasks(data);
    } catch {
      /* silent */
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  const handleComplete = async (taskId: string) => {
    setCompletingId(taskId);
    try {
      await tasksApi.completeTask(taskId);
      setTasks((prev) =>
        prev.map((t) =>
          t.id === taskId
            ? { ...t, status: 'COMPLETED' as const, completed_at: new Date().toISOString() }
            : t,
        ),
      );
      toast.success('Task completed');
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to complete task'));
    } finally {
      setCompletingId(null);
    }
  };

  const pendingTasks = tasks.filter((t) => t.status !== 'COMPLETED');
  const completedTasks = tasks.filter((t) => t.status === 'COMPLETED');

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Spinner className="h-6 w-6" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2.5">
          <ListTodo className="h-6 w-6 text-primary" />
          My Tasks
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Tasks assigned to you across all projects.
        </p>
      </div>

      {tasks.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center space-y-3">
            <ListTodo className="h-10 w-10 text-muted-foreground/40 mx-auto" />
            <p className="text-muted-foreground text-sm">No tasks assigned to you yet.</p>
            <p className="text-xs text-muted-foreground">
              Tasks will appear here when someone assigns you to work on, review, or approve documents.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Pending tasks */}
          {pendingTasks.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Pending ({pendingTasks.length})</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {pendingTasks.map((task) => (
                  <div
                    key={task.id}
                    className="flex items-center gap-3 rounded-lg border px-4 py-3 hover:bg-accent/30 transition-colors"
                  >
                    <Badge className={TASK_TYPE_COLORS[task.type]}>
                      {TASK_TYPE_LABELS[task.type]}
                    </Badge>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {task.step?.title ?? 'Step task'}
                      </p>
                      <p className="text-xs text-muted-foreground flex items-center gap-2">
                        {task.project && (
                          <span className="flex items-center gap-1">
                            <FolderOpen className="h-3 w-3" />
                            {task.project.name}
                          </span>
                        )}
                        {task.assigner && (
                          <span>Assigned by {task.assigner.first_name}</span>
                        )}
                      </p>
                    </div>
                    {task.deadline && (
                      <span className="text-xs text-muted-foreground flex items-center gap-1 shrink-0">
                        <Clock className="h-3 w-3" />
                        {new Date(task.deadline).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                        })}
                      </span>
                    )}
                    {task.step && task.project && (
                      <Link
                        href={`/dashboard/organizations/${task.project.organization_id}/projects/${task.project_id}/steps/${task.step_id}`}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </Link>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleComplete(task.id)}
                      disabled={completingId === task.id}
                    >
                      {completingId === task.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <CheckCircle2 className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Completed tasks */}
          {completedTasks.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base text-muted-foreground">
                  Completed ({completedTasks.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {completedTasks.map((task) => (
                  <div
                    key={task.id}
                    className="flex items-center gap-3 rounded-lg border px-4 py-3 opacity-60"
                  >
                    <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                    <Badge className={TASK_TYPE_COLORS[task.type]}>
                      {TASK_TYPE_LABELS[task.type]}
                    </Badge>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm truncate line-through">
                        {task.step?.title ?? 'Step task'}
                      </p>
                    </div>
                    {task.completed_at && (
                      <span className="text-xs text-muted-foreground shrink-0">
                        {new Date(task.completed_at).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                        })}
                      </span>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
