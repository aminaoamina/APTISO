'use client';

import { useEffect } from 'react';
import { PHASE3_CANDIDATES, SECURITY_DOCUMENTATION_PHASE_ORDER } from '@/lib/policy-catalog';
import { useParams, useRouter } from 'next/navigation';
import {
  ChevronRight,
  FileText,
  BookOpen,
  CheckCircle2,
  Circle,
  CircleDashed,
  ShieldCheck,
} from 'lucide-react';
import { useProjectStore } from '@/store/project-store';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Spinner } from '@/components/ui/spinner';
import { Progress as ProgressBar } from '@/components/ui/progress';
import { PROGRESS_BADGE, PROGRESS_LABELS, phaseCounts } from '@/lib/progress';

export default function ImplementationStepsPage() {
  const params = useParams();
  const router = useRouter();
  const orgId = params.orgId as string;
  const projectId = params.projectId as string;
  const { currentProject, phases, isLoading, selectProject } = useProjectStore();

  useEffect(() => {
    if (projectId) selectProject(projectId);
  }, [projectId, selectProject]);

  if (isLoading || !currentProject) {
    return (
      <div className="flex items-center justify-center py-16">
        <Spinner className="h-6 w-6" />
      </div>
    );
  }

  const framework = currentProject.compliance_framework;
  const phasesWithSteps = phases.filter((p) => (p.steps?.length ?? 0) > 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Implementation Steps</h1>
        <p className="text-muted-foreground text-sm mt-1 flex items-center gap-1.5">
          <ShieldCheck className="h-4 w-4 text-primary" />
          {framework ? `${framework.name}${framework.version ? ` :${framework.version}` : ''}` : 'Compliance'}{' '}
          guided implementation for {currentProject.name}
        </p>
      </div>

      {phases.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="py-10 text-center">
            <p className="text-muted-foreground text-sm">No phases defined for this project.</p>
          </CardContent>
        </Card>
      )}

      {/* Phases with steps */}
      {phases.map((phase) => {
        const steps = phase.steps ?? [];
        const { completed } = phaseCounts(steps);

        return (
          <Card key={phase.id}>
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <CardTitle className="text-base">
                    Phase {phase.order} — {phase.name}
                  </CardTitle>
                  {phase.description && (
                    <p className="text-muted-foreground text-xs mt-0.5">{phase.description}</p>
                  )}
                </div>
                <Badge className={PROGRESS_BADGE[phase.progress]}>
                  {PROGRESS_LABELS[phase.progress]}
                </Badge>
              </div>
              {steps.length > 0 && (
                <div className="mt-2 flex items-center gap-3">
                  <ProgressBar value={(completed / steps.length) * 100} className="h-1.5 flex-1" />
                  <span className="text-xs text-muted-foreground shrink-0">{completed} / {steps.length} steps completed</span>
                </div>
              )}
            </CardHeader>
            <CardContent className="pt-0">
              {steps.length === 0 && phase.order === SECURITY_DOCUMENTATION_PHASE_ORDER ? (
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">
                    After completing the Statement of Applicability, the necessary policy and procedure documents (from the list below) will be automatically added as steps here:
                  </p>
                  <ul className="grid gap-x-6 gap-y-1 text-xs text-muted-foreground sm:grid-cols-2 list-disc pl-5">
                    {PHASE3_CANDIDATES.map((t) => <li key={t}>{t}</li>)}
                  </ul>
                </div>
              ) : steps.length === 0 ? (
                <p className="text-xs text-muted-foreground italic">
                  Steps for this phase will be available soon.
                </p>
              ) : (
                <div className="divide-y divide-border/60 -mx-2">
                  {steps.map((step) => {
                    const isDone = step.status === 'COMPLETED';
                    const stepHref = `/dashboard/organizations/${orgId}/projects/${projectId}/steps/${step.id}`;
                    return (
                      <button
                        key={step.id}
                        onClick={() => router.push(stepHref)}
                        className="w-full flex items-center gap-3 px-2 py-3 text-left hover:bg-muted/40 rounded-md transition-colors"
                      >
                        {isDone ? (
                          <CheckCircle2 className="h-5 w-5 shrink-0 text-green-500" aria-label="Completed" />
                        ) : step.progress === 'IN_PROGRESS' ? (
                          <CircleDashed className="h-5 w-5 shrink-0 text-blue-500" aria-label="In progress" />
                        ) : (
                          <Circle className="h-5 w-5 shrink-0 text-muted-foreground/40" aria-label="Not started" />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm truncate ${isDone ? 'text-muted-foreground line-through' : 'font-medium'}`}>
                            Step {step.order}: {step.title}
                            {step.progress === 'IN_PROGRESS' && (
                              <Badge className={`ml-2 text-[10px] font-normal ${PROGRESS_BADGE.IN_PROGRESS}`}>In progress</Badge>
                            )}
                            {step.metadata_json?.required === false && (
                              <Badge variant="outline" className="ml-2 text-[10px] font-normal no-underline">No longer required</Badge>
                            )}
                          </p>
                          <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                            {step.type === 'DOCUMENT' ? (
                              <>
                                <FileText className="h-3 w-3" /> Document step
                              </>
                            ) : step.type === 'REGISTER' ? (
                              <>
                                <FileText className="h-3 w-3" /> Register step
                              </>
                            ) : (
                              <>
                                <BookOpen className="h-3 w-3" /> Educational step
                              </>
                            )}
                            {step.document_instance && (
                              <>
                                {' · '}
                                Document {step.document_instance.version} ·{' '}
                                {step.document_instance.status.toLowerCase()}
                              </>
                            )}
                          </p>
                        </div>
                        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                      </button>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}

      {/* Future phases note */}
      {phasesWithSteps.length > 0 && phases.some((p) => (p.steps?.length ?? 0) === 0) && (
        <p className="text-xs text-muted-foreground text-center pt-2">
          Remaining phases are being prepared and will unlock as the implementation progresses.
        </p>
      )}
    </div>
  );
}
