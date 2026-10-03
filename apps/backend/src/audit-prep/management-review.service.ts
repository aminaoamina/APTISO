import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditAction, Prisma, ReviewDecisionType, ReviewFrequency, TaskType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../common/services/audit-log.service';
import { TasksService } from '../tasks/tasks.service';
import { ProjectAccess, ProjectAccessService } from '../common/services/project-access.service';
import { StepDocumentService, formatDate, latest } from '../common/services/step-document.service';
import { heading, paragraph, table, text, ProseMirrorNode } from '../documents/templates/doc-control.template';
import { ImprovementService } from './improvement.service';
import {
  CreateReviewDto,
  DecisionDto,
  ReviewSetupDto,
  UpdateDecisionDto,
  UpdateReviewDto,
  UpdateReviewInputDto,
} from './dto/audit-prep.dto';
import { FREQUENCY_LABELS, FREQUENCY_MONTHS, P4, REQUIREMENTS_KEY, RISK_REGISTER_KEY, SOA_KEY, checklist } from './keys';

type ReviewItem = { key: string; title: string; materials?: string; mandatory?: boolean };

/** The inputs top management must consider (ISO/IEC 27001:2022 clause 9.3.2). */
export const ISO_REVIEW_INPUTS: ReviewItem[] = [
  { key: '9.3.2a', title: 'Status of actions from previous management reviews', materials: 'Decisions and actions of the previous review', mandatory: true },
  { key: '9.3.2b', title: 'Changes in external and internal issues relevant to the ISMS', materials: 'ISMS scope document, context analysis', mandatory: true },
  { key: '9.3.2c', title: 'Changes in needs and expectations of interested parties relevant to the ISMS', materials: 'Register of Legal, Contractual, and Other Requirements', mandatory: true },
  { key: '9.3.2d1', title: 'Nonconformities and corrective actions', materials: 'Nonconformity register, corrective actions', mandatory: true },
  { key: '9.3.2d2', title: 'Monitoring and measurement results', materials: 'Security objectives fulfilment report, incident register', mandatory: true },
  { key: '9.3.2d3', title: 'Audit results', materials: 'Internal audit reports, external audit reports', mandatory: true },
  { key: '9.3.2d4', title: 'Fulfilment of information security objectives', materials: 'List of security objectives and fulfilment report', mandatory: true },
  { key: '9.3.2e', title: 'Feedback from interested parties', materials: 'Customer, supplier and employee feedback', mandatory: true },
  { key: '9.3.2f', title: 'Results of risk assessment and status of the risk treatment plan', materials: 'Risk Assessment and Treatment Report, Risk Treatment Plan', mandatory: true },
  { key: '9.3.2g', title: 'Opportunities for continual improvement', materials: 'Proposals from employees, audits and incidents', mandatory: true },
];

export const DECISION_LABELS: Record<ReviewDecisionType, string> = {
  IMPROVEMENT: 'Continual improvement opportunity',
  ISMS_CHANGE: 'Change to the ISMS',
  RESOURCES: 'Resource need',
  OTHER: 'Other decision',
};

const REVIEW_INCLUDE = {
  inputs: { orderBy: { order: 'asc' } },
  decisions: { orderBy: { created_at: 'asc' } },
} satisfies Prisma.ManagementReviewInclude;

const addMonths = (d: Date, months: number) => {
  const r = new Date(d);
  r.setMonth(r.getMonth() + months);
  return r;
};

/** Clauses 5.1, 9.3, 10: setting up and performing management reviews. */
@Injectable()
export class ManagementReviewService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
    private readonly tasks: TasksService,
    private readonly access: ProjectAccessService,
    private readonly documents: StepDocumentService,
    private readonly improvement: ImprovementService,
  ) {}

  // ─── Step 5: setting up management review ──────────────────────

  async getSetup(stepId: string, userId: string) {
    const access = await this.access.forStep(stepId, userId, P4.REVIEW_SETUP);
    const [setup, members, completion] = await Promise.all([
      this.ensureSetup(access.projectId),
      this.access.members(access.projectId),
      this.getSetupCompletion(stepId),
    ]);
    return {
      setup: { ...setup, items: setup.items as ReviewItem[], reviewer_ids: setup.reviewer_ids as string[] },
      isoInputs: ISO_REVIEW_INPUTS,
      members,
      completion,
      // Conformio: only the Sponsor (top management) edits the review items.
      permissions: { canEdit: access.canDecide, canDecide: access.canDecide, userId },
    };
  }

  private async ensureSetup(projectId: string) {
    const existing = await this.prisma.managementReviewSetup.findUnique({ where: { project_id: projectId } });
    if (existing) return existing;
    const topManagement = (await this.access.members(projectId)).filter(m => m.is_top_management || m.privilege === 'PROJECT_LEAD');
    return this.prisma.managementReviewSetup.create({
      data: {
        project_id: projectId,
        reviewer_ids: topManagement.map(m => m.id),
        items: ISO_REVIEW_INPUTS,
      },
    });
  }

  async saveSetup(stepId: string, dto: ReviewSetupDto, userId: string) {
    const access = await this.access.forStep(stepId, userId, P4.REVIEW_SETUP);
    this.access.assertDecide(access);
    await this.access.assertMembers(access.projectId, dto.reviewer_ids);
    if (dto.reviewer_ids.length === 0) throw new BadRequestException('Select at least one member of top management as reviewer');

    // The clause 9.3.2 inputs are mandatory; users can adapt their materials and add their own items.
    const custom = dto.items.filter(i => !ISO_REVIEW_INPUTS.some(iso => iso.key === i.key));
    const items: ReviewItem[] = [
      ...ISO_REVIEW_INPUTS.map(iso => ({ ...iso, materials: dto.items.find(i => i.key === iso.key)?.materials?.trim() || iso.materials })),
      ...custom.map(i => ({ key: i.key, title: i.title.trim(), materials: i.materials?.trim(), mandatory: false })),
    ];
    await this.ensureSetup(access.projectId);
    await this.prisma.managementReviewSetup.update({
      where: { project_id: access.projectId },
      data: {
        frequency: dto.frequency,
        next_review_date: dto.next_review_date ? new Date(dto.next_review_date) : null,
        reviewer_ids: [...new Set(dto.reviewer_ids)],
        items: items as unknown as Prisma.InputJsonValue,
        configured_at: new Date(),
      },
    });
    await this.log(userId, access.projectId, { action: 'setup_management_review', items: items.length });
    return this.getSetup(stepId, userId);
  }

  async getSetupCompletion(stepId: string) {
    const step = await this.prisma.projectStep.findUnique({ where: { id: stepId }, select: { phase: { select: { project_id: true } } } });
    if (!step) throw new NotFoundException('Step not found');
    const setup = await this.prisma.managementReviewSetup.findUnique({ where: { project_id: step.phase.project_id } });
    const reviewers = (setup?.reviewer_ids as string[] | undefined) ?? [];
    return checklist([
      { key: 'reviewers', label: 'Top management reviewers are selected', done: reviewers.length > 0, detail: 'No reviewer selected' },
      { key: 'date', label: 'The date of the first management review is planned', done: !!setup?.next_review_date, detail: 'No date planned' },
      { key: 'saved', label: 'The review items and frequency are confirmed', done: !!setup?.configured_at, detail: 'Save the setup' },
    ]);
  }

  // ─── Step 7: management review meeting ─────────────────────────

  async getReviews(stepId: string, userId: string) {
    const access = await this.access.forStep(stepId, userId, P4.MANAGEMENT_REVIEW);
    const [reviews, setup, members, documents, completion] = await Promise.all([
      this.prisma.managementReview.findMany({ where: { project_id: access.projectId }, include: REVIEW_INCLUDE, orderBy: { review_date: 'desc' } }),
      this.prisma.managementReviewSetup.findUnique({ where: { project_id: access.projectId } }),
      this.access.members(access.projectId),
      this.documents.list(stepId),
      this.getReviewCompletion(stepId),
    ]);
    const now = new Date();
    const decisions = reviews.flatMap(r => r.decisions);
    return {
      reviews,
      setup: setup ? { ...setup, reviewer_ids: setup.reviewer_ids as string[], items: setup.items as ReviewItem[] } : null,
      members,
      counters: {
        planned: decisions.filter(d => d.status !== 'DONE' && (!d.due_date || d.due_date >= now)).length,
        late: decisions.filter(d => d.status !== 'DONE' && d.due_date && d.due_date < now).length,
        completed: decisions.filter(d => d.status === 'DONE').length,
      },
      documents,
      completion,
      permissions: { canEdit: access.canEdit, canDecide: access.canDecide, userId },
    };
  }

  /** "Start management review": inputs are pre-filled with a summary of every ISMS module. */
  async createReview(stepId: string, dto: CreateReviewDto, userId: string) {
    const access = await this.access.forStep(stepId, userId, P4.MANAGEMENT_REVIEW);
    this.access.assertEdit(access);
    const setup = await this.prisma.managementReviewSetup.findUnique({ where: { project_id: access.projectId } });
    if (!setup?.configured_at) throw new BadRequestException('Set up the management review first (previous step)');
    await this.access.assertMembers(access.projectId, dto.participant_ids);
    const open = await this.prisma.managementReview.count({ where: { project_id: access.projectId, status: { not: 'COMPLETED' } } });
    if (open > 0) throw new BadRequestException('Complete the current management review before starting a new one');

    const summaries = await this.buildInputSummaries(access);
    const items = setup.items as ReviewItem[];
    await this.prisma.managementReview.create({
      data: {
        project_id: access.projectId,
        title: dto.title?.trim() || `Management review ${formatDate(new Date(dto.review_date))}`,
        review_date: new Date(dto.review_date),
        participant_ids: [...new Set(dto.participant_ids)],
        status: 'IN_PROGRESS',
        created_by: userId,
        inputs: {
          create: items.map((it, i) => ({
            order: i + 1,
            item_key: it.key,
            title: it.title,
            summary: summaries[it.key] ?? `To be presented${it.materials ? ` (materials: ${it.materials})` : ''}.`,
          })),
        },
      },
    });
    await this.log(userId, access.projectId, { action: 'start_management_review' });
    return this.getReviews(stepId, userId);
  }

  /** Refreshes the automatic summaries (the notes written by the participants are kept). */
  async refreshInputs(stepId: string, reviewId: string, userId: string) {
    const { access, review } = await this.loadReview(stepId, reviewId, userId, true);
    const summaries = await this.buildInputSummaries(access);
    for (const input of review.inputs) {
      if (summaries[input.item_key]) {
        await this.prisma.managementReviewInput.update({ where: { id: input.id }, data: { summary: summaries[input.item_key] } });
      }
    }
    return this.getReviews(stepId, userId);
  }

  async updateReview(stepId: string, reviewId: string, dto: UpdateReviewDto, userId: string) {
    const { review } = await this.loadReview(stepId, reviewId, userId, true);
    if (dto.participant_ids) await this.access.assertMembers(review.project_id, dto.participant_ids);
    await this.prisma.managementReview.update({
      where: { id: reviewId },
      data: {
        ...(dto.title !== undefined && { title: dto.title.trim() }),
        ...(dto.review_date !== undefined && { review_date: new Date(dto.review_date) }),
        ...(dto.participant_ids !== undefined && { participant_ids: [...new Set(dto.participant_ids)] }),
        ...(dto.conclusions !== undefined && { conclusions: dto.conclusions.trim() || null }),
      },
    });
    return this.getReviews(stepId, userId);
  }

  async updateInput(stepId: string, reviewId: string, inputId: string, dto: UpdateReviewInputDto, userId: string) {
    const { review } = await this.loadReview(stepId, reviewId, userId, true);
    if (!review.inputs.some(i => i.id === inputId)) throw new NotFoundException('Review input not found');
    await this.prisma.managementReviewInput.update({
      where: { id: inputId },
      data: {
        ...(dto.notes !== undefined && { notes: dto.notes.trim() || null }),
        ...(dto.discussed !== undefined && { discussed: dto.discussed }),
      },
    });
    return this.getReviews(stepId, userId);
  }

  async addDecision(stepId: string, reviewId: string, dto: DecisionDto, userId: string) {
    const { review } = await this.loadReview(stepId, reviewId, userId, true);
    await this.access.assertMembers(review.project_id, [dto.responsible_id]);
    await this.prisma.managementReviewDecision.create({
      data: {
        review_id: reviewId,
        type: dto.type,
        description: dto.description.trim(),
        responsible_id: dto.responsible_id ?? null,
        due_date: dto.due_date ? new Date(dto.due_date) : null,
      },
    });
    return this.getReviews(stepId, userId);
  }

  async updateDecision(stepId: string, reviewId: string, decisionId: string, dto: UpdateDecisionDto, userId: string) {
    const { review } = await this.loadReview(stepId, reviewId, userId, false);
    const decision = review.decisions.find(d => d.id === decisionId);
    if (!decision) throw new NotFoundException('Decision not found');
    // After the review, only the follow-up status of the actions can change.
    if (review.status === 'COMPLETED' && Object.keys(dto).some(k => k !== 'status')) {
      throw new BadRequestException('The review is completed; only the status of its actions can be updated');
    }
    await this.access.assertMembers(review.project_id, [dto.responsible_id]);
    await this.prisma.managementReviewDecision.update({
      where: { id: decisionId },
      data: {
        ...(dto.type !== undefined && { type: dto.type }),
        ...(dto.description !== undefined && { description: dto.description.trim() }),
        ...(dto.responsible_id !== undefined && { responsible_id: dto.responsible_id }),
        ...(dto.due_date !== undefined && { due_date: dto.due_date ? new Date(dto.due_date) : null }),
        ...(dto.status !== undefined && { status: dto.status, completed_at: dto.status === 'DONE' ? new Date() : null }),
      },
    });
    if (dto.status === 'DONE' && decision.task_id) {
      await this.prisma.taskAssignment.updateMany({ where: { id: decision.task_id, status: { not: 'COMPLETED' } }, data: { status: 'COMPLETED', completed_at: new Date() } });
    }
    return this.getReviews(stepId, userId);
  }

  async removeDecision(stepId: string, reviewId: string, decisionId: string, userId: string) {
    const { review } = await this.loadReview(stepId, reviewId, userId, true);
    if (!review.decisions.some(d => d.id === decisionId)) throw new NotFoundException('Decision not found');
    await this.prisma.managementReviewDecision.delete({ where: { id: decisionId } });
    return this.getReviews(stepId, userId);
  }

  /** Closes the review: every input discussed, conclusions recorded, top management present. */
  async completeReview(stepId: string, reviewId: string, userId: string) {
    const { access, review } = await this.loadReview(stepId, reviewId, userId, true);
    const pending = review.inputs.filter(i => !i.discussed).length;
    if (pending > 0) throw new BadRequestException(`${pending} review input(s) have not been discussed yet`);
    if (!review.conclusions?.trim()) throw new BadRequestException('Record the conclusions of top management');
    const members = await this.access.members(access.projectId);
    const participants = review.participant_ids as string[];
    if (!members.some(m => participants.includes(m.id) && (m.is_top_management || m.privilege === 'PROJECT_LEAD'))) {
      throw new BadRequestException('Top management must take part in the management review (clause 9.3.1)');
    }
    const incompleteActions = review.decisions.filter(d => d.type !== 'OTHER' && (!d.responsible_id || !d.due_date)).length;
    if (incompleteActions > 0) throw new BadRequestException(`${incompleteActions} decision(s) need a responsible person and a due date`);

    for (const d of review.decisions.filter(x => x.responsible_id && !x.task_id)) {
      const task = await this.tasks.create({
        projectId: access.projectId,
        organizationId: access.organizationId,
        stepId,
        assignedTo: d.responsible_id!,
        assignedBy: userId,
        type: TaskType.MANAGEMENT_REVIEW_ACTION,
        notes: `${DECISION_LABELS[d.type]} decided in "${review.title}":\n${d.description}`,
        deadline: d.due_date,
      });
      await this.prisma.managementReviewDecision.update({ where: { id: d.id }, data: { task_id: task.id } });
    }
    const setup = await this.prisma.managementReviewSetup.findUnique({ where: { project_id: access.projectId } });
    await this.prisma.$transaction([
      this.prisma.managementReview.update({ where: { id: reviewId }, data: { status: 'COMPLETED', completed_at: new Date() } }),
      // Plan the next review according to the frequency set up in step 5.
      this.prisma.managementReviewSetup.update({
        where: { project_id: access.projectId },
        data: { next_review_date: addMonths(review.review_date, FREQUENCY_MONTHS[setup?.frequency ?? ReviewFrequency.YEARLY]) },
      }),
    ]);
    await this.log(userId, access.projectId, { action: 'complete_management_review', decisions: review.decisions.length });
    return this.getReviews(stepId, userId);
  }

  async createDocument(stepId: string, userId: string) {
    const access = await this.access.forStep(stepId, userId, P4.MANAGEMENT_REVIEW);
    this.access.assertEdit(access);
    const [review, members, project] = await Promise.all([
      this.prisma.managementReview.findFirst({ where: { project_id: access.projectId, status: 'COMPLETED' }, include: REVIEW_INCLUDE, orderBy: { review_date: 'desc' } }),
      this.access.members(access.projectId),
      this.prisma.complianceProject.findUnique({ where: { id: access.projectId }, select: { organization: { select: { name: true } } } }),
    ]);
    if (!review) throw new BadRequestException('Complete a management review first');
    const name = (id: string | null) => members.find(m => m.id === id)?.label ?? '—';

    const content: ProseMirrorNode = {
      type: 'doc',
      content: [
        heading(1, 'Management Review Minutes'),
        table([
          [[text('Organization')], [text(project?.organization?.name ?? 'Organization')]],
          [[text('Review')], [text(review.title)]],
          [[text('Date')], [text(formatDate(review.review_date))]],
          [[text('Participants')], [text((review.participant_ids as string[]).map(name).join(', '))]],
        ]),
        heading(2, '1. Review inputs (clause 9.3.2)'),
        table([
          ['Input', 'Information presented', 'Discussion'].map(h => [text(h)]),
          ...review.inputs.map(i => [[text(i.title)], [text(i.summary)], [text(i.notes || '—')]]),
        ]),
        heading(2, '2. Decisions and actions (clause 9.3.3)'),
        ...(review.decisions.length > 0
          ? [table([
              ['Type', 'Decision / action', 'Responsible', 'Due', 'Status'].map(h => [text(h)]),
              ...review.decisions.map(d => [
                [text(DECISION_LABELS[d.type])], [text(d.description)], [text(name(d.responsible_id))], [text(formatDate(d.due_date))],
                [text(d.status === 'DONE' ? 'Completed' : d.due_date && d.due_date < new Date() ? 'Late' : 'Planned')],
              ]),
            ])]
          : [paragraph(text('No changes to the ISMS or improvement actions were decided.'))]),
        heading(2, '3. Conclusions'),
        paragraph(text(review.conclusions || '—')),
      ],
    };
    await this.documents.upsert({
      stepId,
      templateCode: 'MANAGEMENT-REVIEW-MINUTES',
      templateName: 'Management Review Minutes',
      templateDescription: 'Inputs, decisions and conclusions of the management review (ISO/IEC 27001 clause 9.3).',
      title: 'Management Review Minutes',
      content,
      userId,
    });
    return this.getReviews(stepId, userId);
  }

  async getReviewCompletion(stepId: string) {
    const step = await this.prisma.projectStep.findUnique({ where: { id: stepId }, select: { phase: { select: { project_id: true } } } });
    if (!step) throw new NotFoundException('Step not found');
    const reviews = await this.prisma.managementReview.findMany({
      where: { project_id: step.phase.project_id },
      select: { status: true, updated_at: true, decisions: { select: { updated_at: true } }, inputs: { select: { updated_at: true } } },
    });
    const completed = reviews.filter(r => r.status === 'COMPLETED');
    const doc = await this.documents.status(stepId, latest(completed.flatMap(r => [r.updated_at, ...r.decisions.map(d => d.updated_at), ...r.inputs.map(i => i.updated_at)])));
    return checklist([
      { key: 'review', label: 'A management review has been held and completed', done: completed.length > 0, detail: 'No completed management review' },
      { key: 'document', label: 'The Management Review Minutes are generated and up to date', done: doc.upToDate, detail: doc.exists ? 'The review changed; refresh the minutes' : 'Minutes not generated yet' },
    ]);
  }

  // ─── Automatic input summaries ─────────────────────────────────

  private async buildInputSummaries(access: ProjectAccess): Promise<Record<string, string>> {
    const p = access.projectId;
    const [prev, requirements, improvement, objectives, audits, riskStep, soaStep, trainings] = await Promise.all([
      this.prisma.managementReview.findFirst({ where: { project_id: p, status: 'COMPLETED' }, include: { decisions: true }, orderBy: { review_date: 'desc' } }),
      this.prisma.requirement.count({ where: { step: { key: REQUIREMENTS_KEY, phase: { project_id: p } } } }),
      this.improvement.summary(p),
      this.prisma.securityObjective.findMany({ where: { project_id: p }, include: { measurements: { orderBy: { measured_on: 'desc' }, take: 1 } } }),
      this.prisma.internalAudit.findMany({ where: { project_id: p }, include: { items: { select: { result: true } } } }),
      this.access.stepByKey(p, RISK_REGISTER_KEY),
      this.access.stepByKey(p, SOA_KEY),
      this.prisma.training.groupBy({ by: ['status'], where: { project_id: p }, _count: true }),
    ]);
    const s: Record<string, string> = {};

    s['9.3.2a'] = prev
      ? `Previous review "${prev.title}" (${formatDate(prev.review_date)}): ${prev.decisions.filter(d => d.status === 'DONE').length} of ${prev.decisions.length} action(s) completed.`
      : 'This is the first management review; there are no actions from previous reviews.';
    s['9.3.2c'] = `${requirements} legal, regulatory and contractual requirement(s) are recorded in the Register of Requirements. Present any changes since the last review.`;
    s['9.3.2d1'] = `${improvement.nonconformities.total} nonconformity(ies): ${improvement.nonconformities.open} open, ${improvement.nonconformities.resolved} resolved, ${improvement.nonconformities.notRelevant} not relevant. ${improvement.correctiveActions.done} of ${improvement.correctiveActions.total} corrective action(s) done.`;

    const trainingCount = Object.fromEntries(trainings.map(t => [t.status, t._count])) as Record<string, number>;
    s['9.3.2d2'] = `${improvement.incidents.total} event(s) in the Incident register, of which ${improvement.incidents.security} information security incident(s) and ${improvement.incidents.open} still open. Trainings: ${trainingCount.PERFORMED ?? 0} performed, ${(trainingCount.APPROVED ?? 0) + (trainingCount.SCHEDULED ?? 0)} planned.`;

    const findings = audits.flatMap(a => a.items).reduce<Record<string, number>>((acc, i) => { if (i.result) acc[i.result] = (acc[i.result] ?? 0) + 1; return acc; }, {});
    s['9.3.2d3'] = audits.length === 0
      ? 'No internal audit has been performed yet.'
      : `${audits.length} internal audit(s), ${audits.filter(a => a.status === 'APPROVED').length} with an approved report: ${findings.MAJOR_NONCONFORMITY ?? 0} major and ${findings.MINOR_NONCONFORMITY ?? 0} minor nonconformities, ${findings.OBSERVATION ?? 0} observation(s).`;

    const measured = objectives.filter(o => o.measurements.length > 0);
    s['9.3.2d4'] = `${objectives.length} security objective(s), ${objectives.filter(o => o.status === 'APPROVED').length} approved. Latest measurements: ${measured.filter(o => o.measurements[0].achieved).length} achieved, ${measured.filter(o => !o.measurements[0].achieved).length} not achieved, ${objectives.length - measured.length} not measured yet.`;

    if (riskStep || soaStep) {
      const [risks, soaRows] = await Promise.all([
        riskStep ? this.prisma.riskItem.findMany({ where: { step_id: riskStep.id, discarding: false }, select: { acceptability: true, approval_decision: true } }) : [],
        soaStep ? this.prisma.soaControl.findMany({ where: { step_id: soaStep.id, applicable: true }, select: { status: true } }) : [],
      ]);
      const planned = soaRows.filter(r => r.status !== 'IMPLEMENTED').length;
      s['9.3.2f'] = `${risks.length} risk(s) assessed, ${risks.filter(r => r.acceptability === 'NOT_ACCEPTABLE').length} unacceptable, ${risks.filter(r => r.approval_decision === 'APPROVED').length} residual risk(s) accepted by risk owners. Risk Treatment Plan: ${soaRows.length - planned} of ${soaRows.length} applicable control(s) implemented, ${planned} still to implement.`;
    }
    return s;
  }

  // ─── Helpers ───────────────────────────────────────────────────

  private async loadReview(stepId: string, reviewId: string, userId: string, mustBeOpen: boolean) {
    const access = await this.access.forStep(stepId, userId, P4.MANAGEMENT_REVIEW);
    this.access.assertEdit(access);
    const review = await this.prisma.managementReview.findFirst({ where: { id: reviewId, project_id: access.projectId }, include: REVIEW_INCLUDE });
    if (!review) throw new NotFoundException('Management review not found');
    if (mustBeOpen && review.status === 'COMPLETED') throw new BadRequestException('This management review is completed');
    return { access, review };
  }

  private async log(userId: string, projectId: string, details: Record<string, unknown>) {
    await this.auditLog.log({ userId, action: AuditAction.DOCUMENT_UPDATED, entityType: 'management_review', entityId: projectId, details: details as never });
  }
}

export { FREQUENCY_LABELS };
