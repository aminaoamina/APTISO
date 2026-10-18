import { StepStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { P4 } from '../audit-prep/keys';

export type Progress = 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED';

export interface ProgressSummary {
  completed_steps: number;
  in_progress_steps: number;
  total_steps: number;
  percent: number;
}

export interface StepRow { id: string; key: string; status: StepStatus; completion_data: unknown }
export interface PhaseRow { steps: StepRow[] }

const MAINTENANCE_KEY = 'iso27001.p5s1.maintenance';

/**
 * Progress is derived from the work that exists, never stored: a step is in
 * progress as soon as it has a document, register records, awareness or
 * training sent, tasks or requests; it is completed when it was finished.
 * A phase follows its steps.
 */
export async function loadStartedSteps(prisma: PrismaService, projectId: string, steps: StepRow[]) {
  const ids = steps.map(s => s.id);
  const byStep = { step_id: { in: ids } };
  const project = { project_id: projectId };
  const [docs, requirements, assets, soa, tasks, requests, trainings, audits, reviews, [edited]] = await Promise.all([
    prisma.documentInstance.findMany({ where: byStep, select: { step_id: true } }),
    prisma.requirement.findMany({ where: byStep, distinct: ['step_id'], select: { step_id: true } }),
    prisma.riskAsset.findMany({ where: byStep, distinct: ['step_id'], select: { step_id: true } }),
    prisma.soaRegister.findMany({ where: byStep, select: { step_id: true } }),
    prisma.taskAssignment.findMany({ where: byStep, distinct: ['step_id'], select: { step_id: true } }),
    prisma.resourceRequest.findMany({ where: byStep, distinct: ['step_id'], select: { step_id: true } }),
    prisma.training.count({ where: project }),
    prisma.internalAudit.count({ where: project }),
    prisma.managementReview.count({ where: project }),
    // Objectives, the review setup and the maintenance setup are created with defaults
    // when their page is first opened: only a change made afterwards counts as work.
    prisma.$queryRaw<{ objectives: number; review_setup: number; maintenance: number }[]>`
      SELECT
        (SELECT count(*)::int FROM security_objectives
          WHERE project_id = ${projectId}::uuid AND (updated_at > created_at + interval '1 second' OR approved_at IS NOT NULL)) AS objectives,
        (SELECT count(*)::int FROM management_review_setups
          WHERE project_id = ${projectId}::uuid AND (configured_at IS NOT NULL OR updated_at > created_at + interval '1 second')) AS review_setup,
        (SELECT count(*)::int FROM maintenance_setups
          WHERE project_id = ${projectId}::uuid AND (certification_date IS NOT NULL OR certification_body IS NOT NULL
            OR incident_review_frequency <> 'QUARTERLY' OR training_review_frequency <> 'YEARLY'))
        + (SELECT count(*)::int FROM task_assignments WHERE project_id = ${projectId}::uuid AND activity_key IS NOT NULL) AS maintenance`,
  ]);

  const started = new Set<string>(
    [docs, requirements, assets, soa, tasks, requests].flat().map(r => r.step_id).filter((id): id is string => !!id),
  );
  // Phase 4 and 5 registers belong to the project rather than to a step.
  const projectRegisters: Record<string, number> = {
    [P4.TRAINING_PLAN]: trainings,
    [P4.OBJECTIVES]: edited.objectives,
    [P4.REVIEW_SETUP]: edited.review_setup,
    [P4.INTERNAL_AUDIT]: audits,
    [P4.MANAGEMENT_REVIEW]: reviews,
    [MAINTENANCE_KEY]: edited.maintenance,
  };
  for (const s of steps) {
    const data = s.completion_data as Record<string, unknown> | null;
    if (projectRegisters[s.key] || (data && Object.keys(data).length)) started.add(s.id);
  }
  return started;
}

export function stepProgress(step: StepRow, started: Set<string>): Progress {
  if (step.status === StepStatus.COMPLETED) return 'COMPLETED';
  return started.has(step.id) ? 'IN_PROGRESS' : 'NOT_STARTED';
}

export function phaseProgress(phase: { steps: { progress: Progress }[] }): Progress {
  const { steps } = phase;
  if (steps.length && steps.every(s => s.progress === 'COMPLETED')) return 'COMPLETED';
  return steps.some(s => s.progress !== 'NOT_STARTED') ? 'IN_PROGRESS' : 'NOT_STARTED';
}

export function summarize(phases: { steps: { progress: Progress }[] }[]): ProgressSummary {
  const steps = phases.flatMap(p => p.steps);
  const completed = steps.filter(s => s.progress === 'COMPLETED').length;
  return {
    completed_steps: completed,
    in_progress_steps: steps.filter(s => s.progress === 'IN_PROGRESS').length,
    total_steps: steps.length,
    percent: steps.length ? Math.round((completed / steps.length) * 100) : 0,
  };
}

/** Adds `progress` to every step and phase of a loaded project, and the project summary. */
export async function withProgress<P extends PhaseRow, T extends { id: string; phases: P[] }>(prisma: PrismaService, project: T) {
  const started = await loadStartedSteps(prisma, project.id, project.phases.flatMap(p => p.steps));
  const phases = project.phases.map(p => {
    const steps = p.steps.map(s => ({ ...s, progress: stepProgress(s, started) }));
    return { ...p, steps, progress: phaseProgress({ steps }) };
  });
  return { ...project, phases, progress: summarize(phases) };
}
