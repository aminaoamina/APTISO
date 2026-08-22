'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Link from 'next/link';
import {
  Users,
  Layers,
  CheckCircle2,
  Pencil,
  Trash2,
  Loader2,
  ShieldCheck,
  CalendarDays,
  UserCheck,
} from 'lucide-react';
import { useProjectStore } from '@/store/project-store';
import { useAuthStore } from '@/store/auth-store';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Spinner } from '@/components/ui/spinner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
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

const editProjectSchema = z
  .object({
    name: z.string().min(1, 'Project name is required'),
    description: z.string().optional(),
    start_date: z.string().optional(),
    target_date: z.string().optional(),
  })
  .refine(
    (data) => {
      if (!data.start_date || !data.target_date) return true;
      return new Date(data.target_date) >= new Date(data.start_date);
    },
    {
      message: 'Target date must be on or after the start date.',
      path: ['target_date'],
    },
  );

type EditProjectForm = z.infer<typeof editProjectSchema>;

const toDateInputValue = (isoDate: string | null | undefined) =>
  isoDate ? isoDate.slice(0, 10) : '';

export default function ProjectDetailPage() {
  const params = useParams();
  const router = useRouter();
  const orgId = params.orgId as string;
  const projectId = params.projectId as string;
  const { currentProject, phases, members, isLoading, selectProject, updateProject, deleteProject } =
    useProjectStore();
  const user = useAuthStore((s) => s.user);
  const [isDeleting, setIsDeleting] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const form = useForm<EditProjectForm>({
    resolver: zodResolver(editProjectSchema),
    defaultValues: { name: '', description: '', start_date: '', target_date: '' },
  });

  const isLead =
    currentProject?.members?.some(
      (m) => m.user_id === user?.id && m.privilege === 'PROJECT_LEAD',
    ) ?? false;

  useEffect(() => {
    if (projectId) selectProject(projectId);
  }, [projectId, selectProject]);

  const openEditDialog = () => {
    if (!currentProject) return;
    form.reset({
      name: currentProject.name,
      description: currentProject.description || '',
      start_date: toDateInputValue(currentProject.start_date),
      target_date: toDateInputValue(currentProject.target_date),
    });
    setEditDialogOpen(true);
  };

  const handleUpdate = async (data: EditProjectForm) => {
    if (!currentProject) return;
    try {
      await updateProject(currentProject.id, {
        name: data.name,
        description: data.description || undefined,
        start_date: data.start_date || undefined,
        target_date: data.target_date || undefined,
      });
      toast.success('Project updated');
      setEditDialogOpen(false);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to update project'));
    }
  };

  const handleDelete = async () => {
    if (!currentProject) return;
    setIsDeleting(true);
    try {
      await deleteProject(currentProject.id);
      toast.success('Project deleted');
      router.push(`/dashboard/organizations/${orgId}/projects`);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to delete project'));
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

  const formatDate = (date: string | null) =>
    date
      ? new Date(date).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        })
      : null;

  const leadAuditor = members.find((m) => m.privilege === 'PROJECT_LEAD')?.user;
  const framework = currentProject.framework;

  const completedPhases = phases.filter((p) => p.status === 'COMPLETED').length;
  const currentPhase = phases.find((p) => p.status === 'IN_PROGRESS');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight">{currentProject.name}</h1>
            <Badge className={statusBadgeColors[currentProject.status]}>
              {statusLabels[currentProject.status]}
            </Badge>
          </div>
          {currentProject.description && (
            <p className="text-muted-foreground text-sm mt-1 max-w-2xl">
              {currentProject.description}
            </p>
          )}
        </div>
        {isLead && (
          <div className="flex items-center gap-2 shrink-0">
            <Button variant="outline" size="sm" onClick={openEditDialog}>
              <Pencil className="h-4 w-4 mr-1" />
              Edit
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setDeleteDialogOpen(true)}
            >
              <Trash2 className="h-4 w-4 mr-1" />
              Delete
            </Button>
          </div>
        )}
      </div>

      {/* Project information */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1.5">
              <ShieldCheck className="h-4 w-4" /> Framework
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="font-semibold truncate">
              {framework ? framework.name : 'Not set'}
              {framework?.version && (
                <span className="ml-1.5 text-sm font-normal text-muted-foreground">
                  :{framework.version}
                </span>
              )}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1.5">
              <CalendarDays className="h-4 w-4" /> Start Date
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="font-semibold">{formatDate(currentProject.start_date) || '—'}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1.5">
              <CalendarDays className="h-4 w-4" /> Target Date
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="font-semibold">{formatDate(currentProject.target_date) || '—'}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1.5">
              <UserCheck className="h-4 w-4" /> Lead Auditor
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="font-semibold truncate">
              {leadAuditor
                ? `${leadAuditor.first_name} ${leadAuditor.last_name}`
                : '—'}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Compliance workspace placeholder */}
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-10 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 mb-4">
            <ShieldCheck className="h-6 w-6 text-primary" />
          </div>
          <h3 className="font-display font-semibold text-lg">
            {framework ? `${framework.name}${framework.version ? `:${framework.version}` : ''}` : 'Compliance'}{' '}
            workspace
          </h3>
          <p className="text-muted-foreground text-sm mt-1 max-w-md">
            Your {framework?.name || 'ISO 27001'} implementation workspace will be available
            here — implementation steps, controls, evidence, and audits.
          </p>
        </CardContent>
      </Card>

      {/* Progress stats */}
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
              {currentPhase?.name ||
                (completedPhases === phases.length && phases.length > 0
                  ? 'Completed'
                  : 'Not started')}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Phases timeline */}
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

      {/* Project members */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <CardTitle className="text-base">Project Members</CardTitle>
            <Button variant="outline" size="sm" asChild>
              <Link href={`/dashboard/organizations/${orgId}/projects/${projectId}/members`}>
                <Users className="h-4 w-4 mr-1" />
                Manage Members
              </Link>
            </Button>
          </div>
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
                      {member.user?.first_name?.[0]}
                      {member.user?.last_name?.[0]}
                    </div>
                    <div>
                      <p className="text-sm font-medium">
                        {member.user
                          ? `${member.user.first_name} ${member.user.last_name}`
                          : 'Unknown member'}
                      </p>
                      <p className="text-xs text-muted-foreground">{member.user?.email}</p>
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

      {/* Edit dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Project</DialogTitle>
            <DialogDescription>Update the project information and timeline.</DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleUpdate)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name *</FormLabel>
                    <FormControl>
                      <Input placeholder="Project name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Input placeholder="Brief description" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="start_date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Start Date</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="target_date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Target Date</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              {framework && (
                <div className="rounded-lg border border-dashed border-border bg-muted/40 px-3 py-2.5 text-sm">
                  <span className="text-muted-foreground">Compliance framework:</span>{' '}
                  <span className="font-medium inline-flex items-center gap-1.5">
                    <ShieldCheck className="h-4 w-4 text-primary" />
                    {framework.name}
                    {framework.version && (
                      <span className="text-muted-foreground font-normal">
                        :{framework.version}
                      </span>
                    )}
                  </span>
                  <span className="block text-xs text-muted-foreground mt-0.5">
                    The compliance framework cannot be changed after creation.
                  </span>
                </div>
              )}
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setEditDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={form.formState.isSubmitting}>
                  {form.formState.isSubmitting && (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  )}
                  Save changes
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete project?</DialogTitle>
            <DialogDescription>
              This will permanently delete{' '}
              <span className="font-semibold text-foreground">{currentProject.name}</span>,
              including its phases and member assignments. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={isDeleting}>
              {isDeleting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              <Trash2 className="h-4 w-4 mr-2" />
              Delete permanently
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
