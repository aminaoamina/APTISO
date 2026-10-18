'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Plus,
  Users,
  FolderKanban,
  ArrowRight,
  Loader2,
  CheckCircle2,
  ShieldCheck,
} from 'lucide-react';
import { useOrgStore } from '@/store/org-store';
import { useAuthStore } from '@/store/auth-store';
import { useProjectStore } from '@/store/project-store';
import { frameworksApi } from '@/lib/api';
import type { ComplianceFramework } from '@/lib/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
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

const createProjectSchema = z
  .object({
    name: z.string().min(1, 'Project name is required'),
    description: z.string().optional(),
    start_date: z.string().min(1, 'Start date is required'),
    target_date: z.string().min(1, 'Target date is required'),
    framework_id: z.string().min(1, 'Please select a compliance framework'),
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

type CreateProjectForm = z.infer<typeof createProjectSchema>;

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

export default function ProjectsPage() {
  const params = useParams();
  const router = useRouter();
  const orgId = params.orgId as string;
  const { currentOrg, selectOrg } = useOrgStore();
  const user = useAuthStore((state) => state.user);
  const { projects, isLoading, loadProjects, createProject } = useProjectStore();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [frameworks, setFrameworks] = useState<ComplianceFramework[]>([]);
  const currentRole = currentOrg?.members?.find((member) => member.user_id === user?.id)?.role;
  const canCreateProject = currentRole === 'ORG_OWNER' || currentRole === 'ORG_ADMIN';

  const form = useForm<CreateProjectForm>({
    resolver: zodResolver(createProjectSchema),
    defaultValues: { name: '', description: '', start_date: '', target_date: '', framework_id: '' },
  });

  useEffect(() => {
    if (orgId) {
      selectOrg(orgId);
      loadProjects(orgId);
    }
  }, [orgId, selectOrg, loadProjects]);

  useEffect(() => {
    frameworksApi
      .list()
      .then(setFrameworks)
      .catch(() => toast.error('Failed to load compliance frameworks'));
  }, []);

  const handleCreate = async (data: CreateProjectForm) => {
    try {
      const project = await createProject(orgId, {
        name: data.name,
        description: data.description || undefined,
        start_date: data.start_date || undefined,
        target_date: data.target_date || undefined,
        framework_id: data.framework_id,
      });
      toast.success('Project created');
      setShowCreateDialog(false);
      form.reset();
      router.push(`/dashboard/organizations/${orgId}/projects/${project.id}`);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to create project'));
    }
  };

  const formatDate = (date: string | null) =>
    date
      ? new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
      : null;

  if (isLoading && projects.length === 0) {
    return (
      <div className="flex items-center justify-center py-16">
        <Spinner className="h-6 w-6" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Projects</h1>
          <p className="text-muted-foreground text-sm">
            Compliance projects for {currentOrg?.name}
          </p>
        </div>
        {canCreateProject && (
          <Button onClick={() => setShowCreateDialog(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Create Project
          </Button>
        )}
      </div>

      {projects.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <FolderKanban className="h-12 w-12 text-muted-foreground/50 mb-4" />
          <h3 className="text-lg font-medium">No projects yet</h3>
          <p className="text-muted-foreground text-sm mt-1 mb-4 max-w-sm">
            Create your first compliance project to get started.
          </p>
          {canCreateProject && (
            <Button onClick={() => setShowCreateDialog(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create Project
            </Button>
          )}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => {
            const progress = project.progress?.percent ?? 0;
            return (
              <Card
                key={project.id}
                className="cursor-pointer transition-colors hover:bg-accent/50"
                onClick={() =>
                  router.push(`/dashboard/organizations/${orgId}/projects/${project.id}`)
                }
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-base truncate">{project.name}</CardTitle>
                      <CardDescription className="mt-1">
                        <Badge className={statusBadgeColors[project.status]}>
                          {statusLabels[project.status]}
                        </Badge>
                      </CardDescription>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0 ml-2" />
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {project.description && (
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {project.description}
                    </p>
                  )}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">
                        Progress · {project.progress?.completed_steps ?? 0} / {project.progress?.total_steps ?? 0} steps
                      </span>
                      <span className="font-medium">{progress}%</span>
                    </div>
                    <Progress value={progress} className="h-1.5" />
                  </div>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Users className="h-3.5 w-3.5" />
                      {project._count?.members ?? 0} members
                    </span>
                    {project.start_date && (
                      <span>{formatDate(project.start_date)}</span>
                    )}
                  </div>
                  {project.compliance_framework && (
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground pt-1 border-t border-border/60">
                      <ShieldCheck className="h-3.5 w-3.5 text-primary" />
                      {project.compliance_framework.name}
                      {project.compliance_framework.version && (
                        <span className="text-dim">:{project.compliance_framework.version}</span>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create project dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Project</DialogTitle>
            <DialogDescription>
              Start a compliance project for {currentOrg?.name}.
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleCreate)} className="space-y-5">
              {/* Project information */}
              <div className="space-y-4">
                <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  Project information
                </div>
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
              </div>

              {/* Timeline */}
              <div className="space-y-4">
                <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  Timeline
                </div>
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
              </div>

              {/* Compliance */}
              <div className="space-y-2">
                <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground pb-1">
                  Compliance
                </div>
                <FormItem>
                  <FormLabel>Compliance framework *</FormLabel>
                  <div
                    role="radiogroup"
                    aria-label="Compliance framework"
                    className="grid gap-2"
                  >
                    {frameworks.map((framework) => {
                      const available = framework.status === 'AVAILABLE';
                      const selected =
                        form.watch('framework_id') === framework.id;
                      return (
                        <button
                          key={framework.id}
                          type="button"
                          role="radio"
                          aria-checked={selected}
                          disabled={!available}
                          onClick={() =>
                            form.setValue('framework_id', framework.id, {
                              shouldValidate: true,
                            })
                          }
                          className={`flex items-start gap-3 rounded-xl border p-3 text-left transition-colors ${
                            selected
                              ? 'border-primary bg-primary/5 ring-1 ring-primary'
                              : 'border-border hover:bg-accent/50'
                          } ${!available ? 'opacity-55 cursor-not-allowed' : 'cursor-pointer'}`}
                        >
                          <div
                            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                              selected ? 'bg-primary/15' : 'bg-muted'
                            }`}
                          >
                            <ShieldCheck
                              className={`h-[18px] w-[18px] ${
                                selected ? 'text-primary' : 'text-muted-foreground'
                              }`}
                            />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-sm font-semibold truncate">
                                {framework.name}
                                {framework.version && (
                                  <span className="text-dim font-normal">
                                    {' '}
                                    :{framework.version}
                                  </span>
                                )}
                              </span>
                              {available ? (
                                selected ? (
                                  <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" />
                                ) : (
                                  <Badge variant="outline" className="shrink-0">
                                    Available
                                  </Badge>
                                )
                              ) : (
                                <Badge variant="outline" className="shrink-0 opacity-70">
                                  Coming soon
                                </Badge>
                              )}
                            </div>
                            {framework.description && (
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {framework.description}
                              </p>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                  {form.formState.errors.framework_id && (
                    <p className="text-sm font-medium text-destructive">
                      {form.formState.errors.framework_id.message}
                    </p>
                  )}
                </FormItem>
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowCreateDialog(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={form.formState.isSubmitting}>
                  {form.formState.isSubmitting && (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  )}
                  Create Project
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
