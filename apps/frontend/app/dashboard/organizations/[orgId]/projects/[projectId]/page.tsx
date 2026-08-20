'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Users,
  Layers,
  CheckCircle2,
  Pencil,
  Trash2,
  Loader2,
  ArrowRight,
} from 'lucide-react';
import { useProjectStore } from '@/store/project-store';
import { useAuthStore } from '@/store/auth-store';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Spinner } from '@/components/ui/spinner';
import { toast } from 'sonner';
import { getErrorMessage } from '@/lib/utils';

const statusBadgeColors: Record<string, string> = {
  PLANNING: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  IN_PROGRESS: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  CERTIFIED: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  ON_HOLD: 'bg-gray-100 text-gray-800 dark:bg-gray-800/50 dark:text-gray-400',
};

const statusLabels: Record<string, string> = {
  PLANNING: 'Planning',
  IN_PROGRESS: 'In Progress',
  CERTIFIED: 'Certified',
  ON_HOLD: 'On Hold',
};

const phaseStatusColors: Record<string, string> = {
  NOT_STARTED: 'text-muted-foreground',
  IN_PROGRESS: 'text-blue-500',
  COMPLETED: 'text-green-500',
};

const phaseStatusDotColors: Record<string, string> = {
  NOT_STARTED: 'bg-muted-foreground/30',
  IN_PROGRESS: 'bg-blue-500',
  COMPLETED: 'bg-green-500',
};

export default function ProjectDetailPage() {
  const params = useParams();
  const router = useRouter();
  const orgId = params.orgId as string;
  const projectId = params.projectId as string;
  const { currentProject, phases, members, isLoading, selectProject, deleteProject } =
    useProjectStore();
  const user = useAuthStore((s) => s.user);
  const [isDeleting, setIsDeleting] = useState(false);

  const isLead =
    currentProject?.members?.some(
      (m) => m.user_id === user?.id && m.privilege === 'PROJECT_LEAD',
    ) ?? false;

  useEffect(() => {
    if (projectId) selectProject(projectId);
  }, [projectId, selectProject]);

  const handleDelete = async () => {
    if (!currentProject) return;
    if (!window.confirm('Delete this project? This cannot be undone.')) return;
    setIsDeleting(true);
    try {
      await deleteProject(currentProject.id);
      toast.success('Project deleted');
      router.push(`/dashboard/organizations/${orgId}/projects`);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to delete project'));
    } finally {
      setIsDeleting(false);
    }
  };

  if (isLoading || !currentProject) {
    return (
      <div className="flex items-center justify-center py-16">
        <Spinner className="h-6 w-6" />
      </div>
    );
  }

  const completedPhases = phases.filter((p) => p.status === 'COMPLETED').length;
  const currentPhase = phases.find((p) => p.status === 'IN_PROGRESS');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight">{currentProject.name}</h1>
            <Badge className={statusBadgeColors[currentProject.status]}>
              {statusLabels[currentProject.status]}
            </Badge>
          </div>
          {currentProject.description && (
            <p className="text-muted-foreground text-sm mt-1">{currentProject.description}</p>
          )}
        </div>
        {isLead && (
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link
                href={`/dashboard/organizations/${orgId}/projects/${projectId}/edit`}
              >
                <Pencil className="h-4 w-4 mr-1" />
                Edit
              </Link>
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleDelete}
              disabled={isDeleting}
            >
              {isDeleting ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4 mr-1" />
              )}
              Delete
            </Button>
          </div>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1">
              <Users className="h-4 w-4" /> Members
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{members.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1">
              <CheckCircle2 className="h-4 w-4" /> Phases Completed
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {completedPhases} / {phases.length || 7}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1">
              <Layers className="h-4 w-4" /> Current Phase
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold truncate">
              {currentPhase?.name || (completedPhases === phases.length && phases.length > 0 ? 'Completed' : 'Not started')}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Phases Timeline</CardTitle>
        </CardHeader>
        <CardContent>
          {phases.length === 0 ? (
            <p className="text-muted-foreground text-sm">No phases defined.</p>
          ) : (
            <div className="relative space-y-0">
                {phases.map((phase, idx) => {
                return (
                  <div key={phase.id} className="relative flex gap-4 pb-6 last:pb-0">
                    {idx < phases.length - 1 && (
                      <div className="absolute left-[11px] top-6 h-full w-px bg-border" />
                    )}
                    <div className="relative z-10 flex h-6 w-6 shrink-0 items-center justify-center">
                      <div
                        className={`h-3 w-3 rounded-full ${phaseStatusDotColors[phase.status]}`}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium">{phase.name}</p>
                        <Badge
                          variant="outline"
                          className={`text-xs ${phaseStatusColors[phase.status]}`}
                        >
                          {phase.status === 'NOT_STARTED'
                            ? 'Not Started'
                            : phase.status === 'IN_PROGRESS'
                            ? 'In Progress'
                            : 'Completed'}
                        </Badge>
                      </div>
                      {phase.description && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {phase.description}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Project Members</CardTitle>
        </CardHeader>
        <CardContent>
          {members.length === 0 ? (
            <p className="text-muted-foreground text-sm">No members yet.</p>
          ) : (
            <div className="space-y-3">
              {members.slice(0, 5).map((member) => (
                <div key={member.id} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-sm font-medium">
                      {member.user.first_name?.[0]}
                      {member.user.last_name?.[0]}
                    </div>
                    <div>
                      <p className="text-sm font-medium">
                        {member.user.first_name} {member.user.last_name}
                      </p>
                      <p className="text-xs text-muted-foreground">{member.user.email}</p>
                    </div>
                  </div>
                  <Badge variant="secondary">
                    {member.privilege === 'PROJECT_LEAD'
                      ? 'Lead'
                      : member.privilege === 'PROJECT_AUDITOR'
                      ? 'Auditor'
                      : 'Member'}
                  </Badge>
                </div>
              ))}
              {members.length > 5 && (
                <p className="text-xs text-muted-foreground">+ {members.length - 5} more</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2">
        <Button variant="outline" className="justify-start" asChild>
          <Link href={`/dashboard/organizations/${orgId}/projects/${projectId}/members`}>
            <Users className="h-4 w-4 mr-2" />
            Manage Members
            <ArrowRight className="h-4 w-4 ml-auto" />
          </Link>
        </Button>
        <Button variant="outline" className="justify-start" asChild>
          <Link href={`/dashboard/organizations/${orgId}/projects/${projectId}/members`}>
            <Layers className="h-4 w-4 mr-2" />
            Update Phase
            <ArrowRight className="h-4 w-4 ml-auto" />
          </Link>
        </Button>
      </div>
    </div>
  );
}
