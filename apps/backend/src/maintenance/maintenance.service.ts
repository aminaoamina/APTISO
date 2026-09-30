import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { AuditAction, ReviewFrequency, TaskType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../common/services/audit-log.service';
import { TaskService } from '../common/services/task.service';
import { ProjectAccessService } from '../common/services/project-access.service';
import { FREQUENCY_MONTHS, P4, RISK_REGISTER_KEY, checklist } from '../audit-prep/keys';
import { UpdateMaintenanceDto } from './maintenance.dto';

export const MAINTENANCE_STEP_KEY = 'iso27001.p5s1.maintenance';

/** A task is created this many days before an activity is due. */
const DUE_SOON_DAYS = 14;
const DAY = 24 * 60 * 60 * 1000;

/** Task types that belong to the maintenance cycle. */
const MAINTENANCE_TYPES: TaskType[] = [
  TaskType.RISK_REVIEW,
  TaskType.INTERNAL_AUDIT,
  TaskType.MANAGEMENT_REVIEW_DUE,
  TaskType.OBJECTIVES_REVIEW,
  TaskType.DOCUMENT_REVIEW,
  TaskType.INCIDENTS_REVIEW,
  TaskType.TRAININGS_REVIEW,
];

type ActivityStatus = 'NOT_STARTED' | 'ON_TIME' | 'DUE_SOON' | 'LATE';

/** One reminder that may become a task (per activity, or per objective / document). */
interface Due {
  activity: string;
  type: TaskType;
  /** Stored on the task; null for the risk review, whose tasks predate the key. */
  key: string | null;
  next: Date | null;
  assignee: string;
  notes: string;
  /** Some activities are driven by their module (an audit already scheduled, a review in progress). */
  suppressReminder?: boolean;
}

const addMonths = (d: Date, months: number) => {
  const r = new Date(d);
  r.setMonth(r.getMonth() + months);
  return r;
};
const maxDate = (...dates: (Date | null | undefined)[]) =>
  dates.filter((d): d is Date => !!d).reduce<Date | null>((m, d) => (!m || d > m ? d : m), null);
const minDate = (dates: (Date | null)[]) =>
  dates.filter((d): d is Date => !!d).reduce<Date | null>((m, d) => (!m || d < m ? d : m), null);

const ACTIVITIES = [
  { key: 'objectives', title: 'Review of security objectives', type: TaskType.OBJECTIVES_REVIEW, stepKey: P4.OBJECTIVES, description: 'Measure each approved objective with its frequency and record the result (clause 9.1).' },
  { key: 'risks', title: 'Review of risks', type: TaskType.RISK_REVIEW, stepKey: RISK_REGISTER_KEY, description: 'Review the risks with the risk owners at least once a year, and after significant changes (clause 8.2).' },
  { key: 'internal_audit', title: 'Internal audit', type: TaskType.INTERNAL_AUDIT, stepKey: P4.INTERNAL_AUDIT, description: 'Audit the whole ISMS at least once a year (clause 9.2).' },
  { key: 'documents', title: 'Review of documents', type: TaskType.DOCUMENT_REVIEW, stepKey: null, description: 'Review every published document with its review interval, and update it if necessary (clause 7.5).' },
  { key: 'management_review', title: 'Management review', type: TaskType.MANAGEMENT_REVIEW_DUE, stepKey: P4.MANAGEMENT_REVIEW, description: 'Top management reviews the ISMS at planned intervals (clause 9.3).' },
  { key: 'incidents', title: 'Review of incidents', type: TaskType.INCIDENTS_REVIEW, stepKey: null, description: 'Review the Incident and Nonconformity registers: open items, trends and lessons learned (A.5.27, clause 10.2).' },
  { key: 'trainings', title: 'Review of security trainings', type: TaskType.TRAININGS_REVIEW, stepKey: P4.TRAINING_PLAN, description: 'Check that the planned trainings were performed and evaluated, and plan new ones (clause 7.2).' },
] as const;

/** Phase 5: certification cycle and recurring ISMS activities (Conformio "Maintenance"). */
@Injectable()
export class MaintenanceService {
  private readonly logger = new Logger(MaintenanceService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
    private readonly tasks: TaskService,
    private readonly access: ProjectAccessService,
  ) {}

  // ─── Page ──────────────────────────────────────────────────────

  /** Opening the page also creates any task that is due (same check as the nightly job). */
  async get(projectId: string, userId: string) {
    const access = await this.access.forProject(projectId, userId);
    await this.ensureSetup(projectId);
    if (access.canEdit) await this.runForProject(projectId);
    return this.view(projectId, access);
  }

  async update(projectId: string, dto: UpdateMaintenanceDto, userId: string) {
    const access = await this.access.forProject(projectId, userId);
    this.access.assertDecide(access);
    await this.ensureSetup(projectId);
    await this.prisma.maintenanceSetup.update({
      where: { project_id: projectId },
      data: {
        ...(dto.certification_date !== undefined && { certification_date: dto.certification_date ? new Date(dto.certification_date) : null }),
        ...(dto.certification_body !== undefined && { certification_body: dto.certification_body.trim() || null }),
        ...(dto.certificate_number !== undefined && { certificate_number: dto.certificate_number.trim() || null }),
        ...(dto.incident_review_frequency !== undefined && { incident_review_frequency: dto.incident_review_frequency }),
        ...(dto.training_review_frequency !== undefined && { training_review_frequency: dto.training_review_frequency }),
      },
    });
    await this.auditLog.log({
      userId,
      action: AuditAction.DOCUMENT_UPDATED,
      entityType: 'maintenance',
      entityId: projectId,
      details: { action: 'update_certification_dates', fields: Object.keys(dto) },
    });
    return this.get(projectId, userId);
  }

  async runNow(projectId: string, userId: string) {
    const access = await this.access.forProject(projectId, userId);
    this.access.assertEdit(access);
    await this.ensureSetup(projectId);
    const created = await this.runForProject(projectId);
    return { ...(await this.view(projectId, access)), created };
  }

  private async view(projectId: string, access: { canEdit: boolean; canDecide: boolean; userId: string }) {
    const setup = await this.ensureSetup(projectId);
    const { dues, tasks } = await this.compute(projectId);
    const now = new Date();
    const status = (next: Date | null): ActivityStatus =>
      !next ? 'NOT_STARTED' : next < now ? 'LATE' : next.getTime() - now.getTime() <= DUE_SOON_DAYS * DAY ? 'DUE_SOON' : 'ON_TIME';

    const steps = await this.prisma.projectStep.findMany({
      where: { phase: { project_id: projectId }, key: { in: ACTIVITIES.map(a => a.stepKey).filter((k): k is NonNullable<typeof k> => !!k) } },
      select: { id: true, key: true },
    });
    const activities = ACTIVITIES.map(a => {
      const own = dues.filter(d => d.activity === a.key);
      const next = minDate(own.map(d => d.next));
      const typed = tasks.filter(t => t.type === a.type);
      return {
        key: a.key,
        title: a.title,
        description: a.description,
        step_id: steps.find(s => s.key === a.stepKey)?.id ?? null,
        next_scheduled: next,
        status: status(next),
        items: own.length,
        open_tasks: typed.filter(t => t.status !== 'COMPLETED').length,
        completed_tasks: typed.filter(t => t.status === 'COMPLETED').length,
      };
    });

    const internalAudit = activities.find(a => a.key === 'internal_audit')!;
    return {
      setup,
      dates: {
        ...this.certificationCycle(setup.certification_date, now),
        next_internal_audit: internalAudit.next_scheduled,
      },
      activities,
      completion: await this.completionFor(projectId, activities.filter(a => a.status === 'LATE').length, setup.certification_date),
      permissions: { canEdit: access.canEdit, canDecide: access.canDecide, userId: access.userId },
    };
  }

  /** ISO 17021 cycle: certification, surveillance audits after 1 and 2 years, re-certification after 3. */
  private certificationCycle(certification: Date | null, now: Date) {
    if (!certification) {
      return { certification_date: null, next_surveillance_audit: null, next_recertification: null, cycle: [] as { label: string; date: Date }[] };
    }
    // Re-certification restarts the 3-year cycle.
    let start = new Date(certification);
    while (addMonths(start, 36) <= now) start = addMonths(start, 36);
    const cycle = [
      { label: 'Surveillance audit 1', date: addMonths(start, 12) },
      { label: 'Surveillance audit 2', date: addMonths(start, 24) },
      { label: 'Re-certification audit', date: addMonths(start, 36) },
    ];
    return {
      certification_date: certification,
      next_surveillance_audit: cycle.slice(0, 2).find(c => c.date > now)?.date ?? null,
      next_recertification: cycle[2].date,
      cycle,
    };
  }

  // ─── Recurring activities ──────────────────────────────────────

  /**
   * Creates a task for every activity that is late or due within 14 days and
   * has no open task yet. Idempotent: safe to run any number of times.
   */
  async runForProject(projectId: string): Promise<number> {
    const setup = await this.prisma.maintenanceSetup.findUnique({ where: { project_id: projectId } });
    if (!setup) return 0;
    const [{ dues, tasks }, project] = await Promise.all([
      this.compute(projectId),
      this.prisma.complianceProject.findUnique({ where: { id: projectId }, select: { organization_id: true } }),
    ]);
    if (!project) return 0;
    const lead = await this.lead(projectId);
    if (!lead) return 0;

    const horizon = new Date(Date.now() + DUE_SOON_DAYS * DAY);
    let created = 0;
    for (const d of dues) {
      if (!d.next || d.next > horizon || d.suppressReminder) continue;
      const open = tasks.some(t => t.type === d.type && t.status !== 'COMPLETED' && (d.key === null || t.activity_key === d.key));
      if (open) continue;
      const task = await this.tasks.create({
        projectId,
        organizationId: project.organization_id,
        stepId: null,
        assignedTo: d.assignee,
        assignedBy: lead,
        type: d.type,
        notes: d.notes,
        deadline: d.next,
      });
      await this.prisma.taskAssignment.update({ where: { id: task.id }, data: { activity_key: d.key } });
      tasks.push({ type: d.type, status: 'PENDING', activity_key: d.key, completed_at: null, deadline: d.next });
      created++;
    }
    await this.prisma.maintenanceSetup.update({ where: { project_id: projectId }, data: { last_run_at: new Date() } });
    return created;
  }

  /** Nightly job: every project whose maintenance cycle has started. */
  async runAll() {
    const setups = await this.prisma.maintenanceSetup.findMany({ select: { project_id: true } });
    let created = 0;
    for (const s of setups) {
      try {
        created += await this.runForProject(s.project_id);
      } catch (e) {
        this.logger.error(`Maintenance run failed for project ${s.project_id}: ${(e as Error).message}`);
      }
    }
    this.logger.log(`Maintenance run: ${setups.length} project(s), ${created} task(s) created`);
    return created;
  }

  /** Next date of every activity, derived from the ISMS modules. */
  private async compute(projectId: string) {
    const setup = await this.ensureSetup(projectId);
    const lead = (await this.lead(projectId)) ?? '';
    const [tasks, riskStep, audits, reviewSetup, openReview, objectives, documents] = await Promise.all([
      this.prisma.taskAssignment.findMany({
        where: { project_id: projectId, type: { in: MAINTENANCE_TYPES } },
        select: { type: true, status: true, activity_key: true, completed_at: true, deadline: true },
      }),
      this.prisma.projectStep.findFirst({ where: { key: RISK_REGISTER_KEY, phase: { project_id: projectId } }, select: { status: true, completed_at: true } }),
      this.prisma.internalAudit.findMany({ where: { project_id: projectId }, select: { status: true, start_date: true, end_date: true } }),
      this.prisma.managementReviewSetup.findUnique({ where: { project_id: projectId } }),
      this.prisma.managementReview.findFirst({ where: { project_id: projectId, status: { not: 'COMPLETED' } }, select: { review_date: true } }),
      this.prisma.securityObjective.findMany({
        where: { project_id: projectId, status: 'APPROVED' },
        select: { id: true, title: true, frequency: true, approved_at: true, responsible_id: true, measurements: { select: { measured_on: true }, orderBy: { measured_on: 'desc' }, take: 1 } },
      }),
      this.prisma.documentInstance.findMany({
        where: { status: 'PUBLISHED', step: { phase: { project_id: projectId } } },
        select: { id: true, title: true, update_interval: true, owner_id: true, updated_at: true, versions: { select: { published_at: true }, orderBy: { published_at: 'desc' }, take: 1 } },
      }),
    ]);
    const lastDone = (type: TaskType, key?: string) =>
      maxDate(...tasks.filter(t => t.type === type && t.status === 'COMPLETED' && (!key || t.activity_key === key)).map(t => t.completed_at));
    const openTask = (type: TaskType) => tasks.find(t => t.type === type && t.status !== 'COMPLETED');
    const months = (f: ReviewFrequency) => FREQUENCY_MONTHS[f];
    const dues: Due[] = [];

    // Review of risks: the yearly RISK_REVIEW task also schedules itself (ProjectsService).
    if (riskStep?.status === 'COMPLETED') {
      const open = openTask(TaskType.RISK_REVIEW);
      dues.push({
        activity: 'risks',
        type: TaskType.RISK_REVIEW,
        key: null,
        next: open?.deadline ?? addMonths(maxDate(riskStep.completed_at, lastDone(TaskType.RISK_REVIEW)) ?? new Date(), 12),
        assignee: lead,
        notes: 'Review of risks (Risk Assessment and Treatment Methodology, section 3.4): with the risk owners, review the existing risks, add new ones, update the Risk Register and refresh the Risk Assessment and Treatment Report.',
      });
    }

    // Internal audit: a scheduled audit drives the date; otherwise one year after the last approved one.
    const active = audits.filter(a => a.status !== 'APPROVED').sort((a, b) => +a.start_date - +b.start_date)[0];
    const lastApproved = maxDate(...audits.filter(a => a.status === 'APPROVED').map(a => a.end_date));
    if (active || lastApproved) {
      dues.push({
        activity: 'internal_audit',
        type: TaskType.INTERNAL_AUDIT,
        key: 'internal_audit',
        next: active ? active.start_date : addMonths(lastApproved!, 12),
        assignee: lead,
        notes: 'The next internal audit is due: schedule it in the Internal Audit module (Phase 4) with an impartial auditor. The whole ISMS must be audited at least once a year (clause 9.2).',
        suppressReminder: !!active,
      });
    }

    // Management review: the date planned in the setup (moved forward when a review is completed).
    if (reviewSetup?.next_review_date || openReview) {
      dues.push({
        activity: 'management_review',
        type: TaskType.MANAGEMENT_REVIEW_DUE,
        key: 'management_review',
        next: openReview?.review_date ?? reviewSetup!.next_review_date,
        assignee: lead,
        notes: 'The management review is due: start it in the Management Review module (Phase 4) with top management (clause 9.3).',
        suppressReminder: !!openReview,
      });
    }

    // Objectives: each approved objective with its measurement frequency.
    for (const o of objectives) {
      const key = `objective:${o.id}`;
      const anchor = maxDate(o.measurements[0]?.measured_on, o.approved_at, lastDone(TaskType.OBJECTIVES_REVIEW, key)) ?? new Date();
      dues.push({
        activity: 'objectives',
        type: TaskType.OBJECTIVES_REVIEW,
        key,
        next: addMonths(anchor, months(o.frequency)),
        assignee: o.responsible_id ?? lead,
        notes: `Measure the security objective "${o.title}" and record the result in the Security Objectives module (clause 9.1).`,
      });
    }

    // Documents: each published document with its review interval (12 months by default).
    for (const d of documents) {
      const key = `document:${d.id}`;
      const anchor = maxDate(d.versions[0]?.published_at, lastDone(TaskType.DOCUMENT_REVIEW, key)) ?? d.updated_at;
      dues.push({
        activity: 'documents',
        type: TaskType.DOCUMENT_REVIEW,
        key,
        next: addMonths(anchor, d.update_interval ?? 12),
        assignee: d.owner_id ?? lead,
        notes: `Review the document "${d.title}": check that it is still accurate and, if necessary, update it and publish a new version (clause 7.5).`,
      });
    }

    // Incidents and trainings: periodic reviews with the frequency set on the maintenance page.
    dues.push({
      activity: 'incidents',
      type: TaskType.INCIDENTS_REVIEW,
      key: 'incidents',
      next: addMonths(maxDate(lastDone(TaskType.INCIDENTS_REVIEW, 'incidents'), setup.created_at)!, months(setup.incident_review_frequency)),
      assignee: lead,
      notes: 'Review the Incident and Nonconformity registers: open incidents and nonconformities, recurring causes, lessons learned, and whether corrective actions are effective.',
    });
    dues.push({
      activity: 'trainings',
      type: TaskType.TRAININGS_REVIEW,
      key: 'trainings',
      next: addMonths(maxDate(lastDone(TaskType.TRAININGS_REVIEW, 'trainings'), setup.created_at)!, months(setup.training_review_frequency)),
      assignee: lead,
      notes: 'Review the Training Plan and Record: were the planned trainings performed and evaluated? Plan the trainings for the next period (clause 7.2).',
    });

    return { dues, tasks };
  }

  // ─── Completion of the Phase 5 step ────────────────────────────

  async getCompletion(stepId: string) {
    const step = await this.prisma.projectStep.findUnique({ where: { id: stepId }, select: { phase: { select: { project_id: true } } } });
    if (!step) throw new NotFoundException('Step not found');
    const projectId = step.phase.project_id;
    const setup = await this.ensureSetup(projectId);
    const { dues } = await this.compute(projectId);
    const late = dues.filter(d => d.next && d.next < new Date()).length;
    return this.completionFor(projectId, late, setup.certification_date);
  }

  private async completionFor(_projectId: string, late: number, certification: Date | null) {
    return checklist([
      { key: 'certified', label: 'The certification date is recorded', done: !!certification, detail: 'Enter the date of certification once the certification audit is passed' },
      { key: 'late', label: 'No maintenance activity is late', done: late === 0, detail: `${late} activit(ies) late` },
    ]);
  }

  // ─── Helpers ───────────────────────────────────────────────────

  async ensureSetup(projectId: string) {
    return this.prisma.maintenanceSetup.upsert({
      where: { project_id: projectId },
      update: {},
      create: { project_id: projectId },
    });
  }

  private async lead(projectId: string) {
    const lead = await this.prisma.projectMember.findFirst({
      where: { project_id: projectId, privilege: 'PROJECT_LEAD' },
      orderBy: { joined_at: 'asc' },
      select: { user_id: true },
    });
    return lead?.user_id ?? null;
  }
}

