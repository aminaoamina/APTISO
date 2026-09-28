import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import {
  AuditAction,
  ControlImplementationStatus,
  IsoRole,
  Prisma,
  ProjectRole,
  StepStatus,
  TaskType,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../common/services/audit-log.service';
import { TaskService } from '../common/services/task.service';
import {
  ProseMirrorNode,
  heading,
  paragraph,
  table,
  text,
  bulletList,
} from '../documents/templates/doc-control.template';
import { ANNEX_A, BASELINE_JUSTIFICATION, SOA_SETUP_QUESTIONS, assertAnnexACatalog } from './annex-a';
import {
  DecisionDto,
  OwnerApprovalRequestDto,
  DecisionRequestDto,
  SaveSetupDto,
  UpdateSoaControlDto,
} from './dto/soa.dto';

const RISK_REGISTER_STEP_KEY = 'iso27001.p2s2.risk-register';
const REQUIREMENTS_STEP_KEY = 'iso27001.p1s5.legal-requirements';
const REPORT_TEMPLATE_CODE = 'SOA';
const PRIVACY_PATTERN = /personal data|privacy|gdpr|data protection|\bpii\b|rgpd/i;

const THEMES: Record<string, string> = {
  '5': 'A.5 Organizational controls',
  '6': 'A.6 People controls',
  '7': 'A.7 Physical controls',
  '8': 'A.8 Technological controls',
};

export const STATUS_LABELS: Record<ControlImplementationStatus, string> = {
  IMPLEMENTED: 'Implemented',
  UNDERWAY: 'Implementation underway',
  PLANNED: 'Planned',
  REVIEW_NEEDED: 'Review needed',
};

type Suggestion = {
  applicable: boolean;
  justification: string;
  method: string | null;
  sources: {
    risks: { ref: string; label: string }[];
    requirements: string[];
    setup: string | null;
  };
};

type Access = { stepId: string; phaseId: string; projectId: string; organizationId: string; role: ProjectRole; isTopManagement: boolean };

const USER_SELECT = { id: true, first_name: true, last_name: true, email: true } as const;

/** Natural order for Annex A codes: A.5.2 before A.5.10. */
export const compareControlCodes = (a: string, b: string) => {
  const pa = a.split('.').slice(1).map(Number);
  const pb = b.split('.').slice(1).map(Number);
  return pa[0] - pb[0] || pa[1] - pb[1];
};

/** An applicable control that is not implemented yet belongs in the Risk Treatment Plan. */
const inTreatmentPlan = (r: { applicable: boolean | null; status: ControlImplementationStatus | null }) =>
  r.applicable === true && r.status !== ControlImplementationStatus.IMPLEMENTED;

@Injectable()
export class SoaService implements OnModuleInit {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
    private readonly tasks: TaskService,
  ) {}

  async onModuleInit() {
    const controls = await this.prisma.riskControl.findMany({ select: { code: true } }).catch(() => null);
    // Before the Annex A seed migration has run there is nothing to compare with.
    if (controls && controls.length > 0) assertAnnexACatalog(controls.map(c => c.code));
  }

  // ─── Read ──────────────────────────────────────────────────────

  async getSoa(stepId: string, userId: string) {
    const access = await this.ensureAccess(stepId, userId);
    const [register, rows, context, projectUsers, approvals, completion] = await Promise.all([
      this.prisma.soaRegister.findUnique({ where: { step_id: stepId } }),
      this.getRows(stepId),
      this.getContext(access),
      this.getProjectUsers(access.projectId),
      this.getApprovals(access),
      this.getCompletion(stepId),
    ]);

    return {
      setup: {
        questions: SOA_SETUP_QUESTIONS.map(({ key, question, help, excludesWhenNo }) => ({ key, question, help, excludes: excludesWhenNo })),
        answers: (register?.setup ?? null) as Record<string, boolean> | null,
        completedAt: register?.setup_completed_at ?? null,
      },
      rtpConfirmedAt: register?.rtp_confirmed_at ?? null,
      rows: rows.map(r => ({
        ...r,
        in_treatment_plan: inTreatmentPlan(r),
        treated_risks: context.risksByControl.get(r.control.code) ?? [],
        documents: ANNEX_A[r.control.code]?.documents ?? [],
      })),
      approvals,
      projectUsers,
      riskRegister: { completed: context.riskRegisterCompleted, risks: context.riskCount },
      summary: this.summarize(rows),
      completion,
      permissions: {
        role: access.role,
        canEdit: access.role !== ProjectRole.PROJECT_AUDITOR,
        isLead: access.role === ProjectRole.PROJECT_LEAD,
        canApproveResources: access.role === ProjectRole.PROJECT_LEAD || access.isTopManagement,
        userId,
      },
    };
  }

  // ─── Stage 1: setup ────────────────────────────────────────────

  async saveSetup(stepId: string, dto: SaveSetupDto, userId: string, ipAddress?: string, userAgent?: string) {
    const access = await this.ensureCanEdit(stepId, userId);
    const missing = SOA_SETUP_QUESTIONS.filter(q => typeof dto.answers[q.key] !== 'boolean');
    if (missing.length > 0) throw new BadRequestException(`Answer every setup question (${missing.length} missing)`);
    const answers = Object.fromEntries(SOA_SETUP_QUESTIONS.map(q => [q.key, dto.answers[q.key]]));

    await this.prisma.soaRegister.upsert({
      where: { step_id: stepId },
      create: { step_id: stepId, setup: answers, setup_completed_at: new Date() },
      update: { setup: answers, setup_completed_at: new Date() },
    });
    await this.ensureRows(stepId);
    // New answers only change controls the user has not edited themselves.
    const applied = await this.applySuggestions(access, false);

    await this.log(userId, stepId, { action: 'soa_setup', answers, applied }, ipAddress, userAgent);
    return this.getSoa(stepId, userId);
  }

  // ─── Stage 2: SoA table ────────────────────────────────────────

  /** Re-computes suggestions from the risk register, requirements and setup. */
  async refreshSuggestions(stepId: string, overwrite: boolean, userId: string, ipAddress?: string, userAgent?: string) {
    const access = await this.ensureCanEdit(stepId, userId);
    const register = await this.prisma.soaRegister.findUnique({ where: { step_id: stepId } });
    if (!register?.setup_completed_at) throw new BadRequestException('Complete the SoA setup first');
    await this.ensureRows(stepId);
    const applied = await this.applySuggestions(access, overwrite);
    await this.log(userId, stepId, { action: 'soa_apply_suggestions', overwrite, applied }, ipAddress, userAgent);
    return this.getSoa(stepId, userId);
  }

  async updateControl(rowId: string, dto: UpdateSoaControlDto, userId: string, ipAddress?: string, userAgent?: string) {
    const row = await this.prisma.soaControl.findUnique({
      where: { id: rowId },
      include: { control: { select: { code: true } } },
    });
    if (!row) throw new NotFoundException('Control not found in this Statement of Applicability');
    const access = await this.ensureCanEdit(row.step_id, userId);

    if (dto.applicable === false) {
      // Clause 6.1.3 c/d: controls selected to treat risks must be in the SoA as applicable.
      const context = await this.getContext(access);
      const risks = context.risksByControl.get(row.control.code) ?? [];
      if (risks.length > 0) {
        throw new BadRequestException(
          `${row.control.code} is used to treat ${risks.map(r => r.ref).join(', ')} in the Risk Register, so it must be applicable. ` +
            'Change the risk treatment first if this control is really not needed.',
        );
      }
    }
    if (dto.responsible_id) {
      const member = await this.prisma.projectMember.findUnique({
        where: { project_id_user_id: { project_id: access.projectId, user_id: dto.responsible_id } },
      });
      if (!member) throw new BadRequestException('The responsible person must be a member of this project');
    }

    const data: Prisma.SoaControlUpdateInput = { is_user_edited: true };
    if (dto.applicable !== undefined) {
      data.applicable = dto.applicable;
      if (!dto.applicable) data.status = null;
      if (dto.applicable && row.implementation_method == null && dto.implementation_method === undefined) {
        data.implementation_method = ANNEX_A[row.control.code]?.method ?? null;
      }
    }
    if (dto.justification !== undefined) data.justification = dto.justification.trim() || null;
    if (dto.implementation_method !== undefined) data.implementation_method = dto.implementation_method.trim() || null;
    if (dto.status !== undefined) data.status = dto.status as ControlImplementationStatus | null;
    if (dto.responsible_id !== undefined) {
      data.responsible = dto.responsible_id ? { connect: { id: dto.responsible_id } } : { disconnect: true };
    }
    if (dto.deadline !== undefined) data.deadline = dto.deadline ? new Date(dto.deadline) : null;
    if (dto.resources !== undefined) {
      const resources = dto.resources.trim() || null;
      data.resources = resources;
      if (resources !== row.resources) {
        // A new or changed request needs a new decision by top management.
        data.resources_decision = resources ? 'PENDING' : null;
        data.resources_comment = null;
        data.resources_decider = { disconnect: true };
        data.resources_decided_at = null;
      }
    }

    const planChanged = ['applicable', 'status', 'responsible_id', 'deadline', 'resources'].some(
      k => (dto as Record<string, unknown>)[k] !== undefined,
    );
    await this.prisma.$transaction(async (tx) => {
      await tx.soaControl.update({ where: { id: rowId }, data });
      if (planChanged) {
        await tx.soaRegister.updateMany({ where: { step_id: row.step_id }, data: { rtp_confirmed_at: null } });
      }
      // Any change to the SoA or the plan must be approved again by the risk owners.
      await tx.soaOwnerApproval.updateMany({
        where: { step_id: row.step_id, decision: { not: 'PENDING' } },
        data: { decision: 'PENDING', decided_by: null, decided_at: null, comment: null },
      });
    });

    await this.log(userId, row.step_id, { action: 'soa_update_control', control: row.control.code, fields: Object.keys(dto) }, ipAddress, userAgent);
    return this.getSoa(row.step_id, userId);
  }

  // ─── Stage 3: Risk Treatment Plan ──────────────────────────────

  /** Validates the SoA and plan, then creates an implementation task per planned control. */
  async confirmTreatmentPlan(stepId: string, userId: string, ipAddress?: string, userAgent?: string) {
    const access = await this.ensureCanEdit(stepId, userId);
    const register = await this.prisma.soaRegister.findUnique({ where: { step_id: stepId } });
    if (!register?.setup_completed_at) throw new BadRequestException('Complete the SoA setup first');

    const rows = await this.getRows(stepId);
    const s = this.summarize(rows);
    const problems = [
      s.undecided > 0 && `${s.undecided} control(s) without an applicability decision`,
      s.unjustified > 0 && `${s.unjustified} control(s) without a justification`,
      s.applicableIncomplete > 0 && `${s.applicableIncomplete} applicable control(s) without implementation method or status`,
      s.planIncomplete > 0 && `${s.planIncomplete} control(s) in the plan without a responsible person or deadline`,
    ].filter(Boolean);
    if (problems.length > 0) throw new BadRequestException(`The plan cannot be confirmed yet: ${problems.join('; ')}`);

    let created = 0;
    for (const row of rows.filter(inTreatmentPlan)) {
      const notes = [
        `Implement ${row.control.code} ${row.control.title} (Risk Treatment Plan).`,
        `Implementation method: ${row.implementation_method}`,
        row.resources ? `Resources: ${row.resources}` : null,
      ].filter(Boolean).join('\n');

      const existing = row.task_id
        ? await this.prisma.taskAssignment.findUnique({ where: { id: row.task_id } })
        : null;
      if (existing && existing.status !== 'COMPLETED' && existing.assigned_to === row.responsible_id) {
        await this.prisma.taskAssignment.update({
          where: { id: existing.id },
          data: { deadline: row.deadline, notes },
        });
        continue;
      }
      const task = await this.tasks.create(
        {
          projectId: access.projectId,
          organizationId: access.organizationId,
          stepId,
          assignedTo: row.responsible_id!,
          assignedBy: userId,
          type: TaskType.IMPLEMENT_CONTROL,
          notes,
          deadline: row.deadline,
        },
        ipAddress,
        userAgent,
      );
      await this.prisma.soaControl.update({ where: { id: row.id }, data: { task_id: task.id } });
      created++;
    }

    await this.prisma.soaRegister.update({ where: { step_id: stepId }, data: { rtp_confirmed_at: new Date() } });
    await this.log(userId, stepId, { action: 'soa_confirm_plan', tasks_created: created }, ipAddress, userAgent);
    return this.getSoa(stepId, userId);
  }

  // ─── Stage 4: resource approval ────────────────────────────────

  async decideResources(rowId: string, dto: DecisionRequestDto, userId: string, ipAddress?: string, userAgent?: string) {
    const row = await this.prisma.soaControl.findUnique({
      where: { id: rowId },
      include: { control: { select: { code: true } } },
    });
    if (!row) throw new NotFoundException('Control not found in this Statement of Applicability');
    const access = await this.ensureCanEdit(row.step_id, userId);
    if (access.role !== ProjectRole.PROJECT_LEAD && !access.isTopManagement) {
      throw new ForbiddenException('Only top management (or the project lead on its behalf) can approve resources');
    }
    if (!row.resources || !inTreatmentPlan(row)) throw new BadRequestException('This control has no resource request');

    await this.prisma.$transaction([
      this.prisma.soaControl.update({
        where: { id: rowId },
        data: {
          resources_decision: dto.decision,
          resources_comment: dto.comment?.trim() || null,
          resources_decider: { connect: { id: userId } },
          resources_decided_at: new Date(),
        },
      }),
      // A rejection sends the plan back for revision.
      ...(dto.decision === DecisionDto.REJECTED
        ? [this.prisma.soaRegister.updateMany({ where: { step_id: row.step_id }, data: { rtp_confirmed_at: null } })]
        : []),
    ]);

    await this.log(userId, row.step_id, { action: 'soa_resources_decision', control: row.control.code, decision: dto.decision }, ipAddress, userAgent);
    return this.getSoa(row.step_id, userId);
  }

  // ─── Stage 5: risk owner approval (clause 6.1.3 f) ─────────────

  async ownerApproval(stepId: string, dto: OwnerApprovalRequestDto, userId: string, ipAddress?: string, userAgent?: string) {
    const access = await this.ensureCanEdit(stepId, userId);
    const ownerId = dto.on_behalf_of ?? userId;
    if (ownerId !== userId && access.role !== ProjectRole.PROJECT_LEAD) {
      throw new ForbiddenException('Only the project lead can decide on behalf of a risk owner');
    }
    const approvers = await this.getApproverIds(access);
    if (!approvers.includes(ownerId)) throw new ForbiddenException('This person is not a risk owner of this project');

    const [register, rows] = await Promise.all([
      this.prisma.soaRegister.findUnique({ where: { step_id: stepId } }),
      this.getRows(stepId),
    ]);
    if (!register?.rtp_confirmed_at) throw new BadRequestException('Confirm the Risk Treatment Plan first');
    const s = this.summarize(rows);
    if (s.resourcesPending > 0 || s.resourcesRejected > 0) {
      throw new BadRequestException('All resource requests must be approved by top management first');
    }

    await this.prisma.$transaction([
      this.prisma.soaOwnerApproval.upsert({
        where: { step_id_user_id: { step_id: stepId, user_id: ownerId } },
        create: {
          step_id: stepId,
          user_id: ownerId,
          decision: dto.decision,
          comment: dto.comment?.trim() || null,
          decided_by: userId,
          decided_at: new Date(),
        },
        update: {
          decision: dto.decision,
          comment: dto.comment?.trim() || null,
          decided_by: userId,
          decided_at: new Date(),
        },
      }),
      ...(dto.decision === DecisionDto.REJECTED
        ? [this.prisma.soaRegister.update({ where: { step_id: stepId }, data: { rtp_confirmed_at: null } })]
        : []),
    ]);

    await this.log(userId, stepId, { action: 'soa_owner_decision', owner: ownerId, on_behalf: ownerId !== userId, decision: dto.decision }, ipAddress, userAgent);
    return this.getSoa(stepId, userId);
  }

  // ─── Output document ───────────────────────────────────────────

  async getDocuments(stepId: string, userId: string) {
    await this.ensureAccess(stepId, userId);
    return this.prisma.documentInstance.findMany({ where: { step_id: stepId } });
  }

  async createDocument(stepId: string, userId: string, ipAddress?: string, userAgent?: string) {
    const access = await this.ensureCanEdit(stepId, userId);
    const rows = await this.getRows(stepId);
    if (rows.length === 0) throw new BadRequestException('Complete the SoA setup first');

    const template = await this.prisma.documentTemplate.findUnique({ where: { code: REPORT_TEMPLATE_CODE } });
    if (!template) throw new NotFoundException(`${REPORT_TEMPLATE_CODE} template not found`);

    const [approvals, org, context] = await Promise.all([
      this.getApprovals(access),
      this.prisma.organization.findUnique({ where: { id: access.organizationId }, select: { name: true } }),
      this.getContext(access),
    ]);
    const content = this.buildDocument(rows, approvals, org?.name ?? 'Organization', context.riskCount);

    const existing = await this.prisma.documentInstance.findUnique({ where: { step_id: stepId } });
    const doc = existing
      ? await this.prisma.documentInstance.update({
          where: { id: existing.id },
          data: { content: content as never, last_edited_by: userId },
        })
      : await this.prisma.documentInstance.create({
          data: {
            template_id: template.id,
            step_id: stepId,
            title: 'Statement of Applicability and Risk Treatment Plan',
            status: 'DRAFT',
            version: '0.1',
            content: content as never,
            created_by: userId,
            last_edited_by: userId,
          },
        });

    await this.log(userId, stepId, { action: 'soa_create_document', document: doc.id }, ipAddress, userAgent);
    return [doc];
  }

  private buildDocument(
    rows: Awaited<ReturnType<SoaService['getRows']>>,
    approvals: Awaited<ReturnType<SoaService['getApprovals']>>,
    orgName: string,
    riskCount: number,
  ): ProseMirrorNode {
    const s = this.summarize(rows);
    const person = (u: { first_name: string; last_name: string; email: string } | null) =>
      u ? `${u.first_name} ${u.last_name}`.trim() || u.email : '—';
    const cellText = (v: string | null | undefined) => [text(v && v.trim() ? v : '—')];
    const date = (d: Date | null) => (d ? formatDate(d) : '—');

    const content: ProseMirrorNode[] = [
      heading(1, 'Statement of Applicability and Risk Treatment Plan'),
      paragraph(text(`Organization: ${orgName}`)),
      paragraph(text(`Date: ${formatDate(new Date())}`)),

      heading(2, '1. Purpose, scope and users'),
      paragraph(text(
        `The purpose of this document is to define which controls of ISO/IEC 27001:2022 Annex A are applicable in ${orgName}, the justification for their inclusion or exclusion, how they are implemented and their implementation status (clause 6.1.3 d), and to plan the implementation of controls that are not yet implemented (Risk Treatment Plan, clause 6.1.3 e). By approving this document the risk owners accept the residual risks (clause 6.1.3 f).`,
      )),

      heading(2, '2. Reference documents'),
      bulletList([
        [text('ISO/IEC 27001 standard, clauses 6.1.3, 6.2 and 8.3, and Annex A')],
        [text('Risk Assessment and Risk Treatment Methodology')],
        [text(`Risk Assessment and Treatment Report (${riskCount} risk(s))`)],
        [text('Register of Legal, Contractual, and Other Requirements')],
      ]),

      heading(2, '3. Summary'),
      table([
        [[text('Indicator')], [text('Value')]],
        [[text('Annex A controls')], [text(String(s.total))]],
        [[text('Applicable controls')], [text(String(s.applicable))]],
        [[text('Not applicable controls')], [text(String(s.notApplicable))]],
        [[text('Applicable controls implemented')], [text(String(s.implemented))]],
        [[text('Applicable controls not yet implemented (Risk Treatment Plan)')], [text(String(s.planned))]],
      ]),
      heading(2, '4. Statement of Applicability'),
    ];

    for (const [theme, title] of Object.entries(THEMES)) {
      const themeRows = rows.filter(r => r.control.code.startsWith(`A.${theme}.`));
      content.push(
        heading(3, title),
        table([
          ['ID', 'Control', 'Applicable', 'Justification', 'Implementation method', 'Status'].map(h => [text(h)]),
          ...themeRows.map(r => [
            [text(r.control.code)],
            [text(r.control.title)],
            [text(r.applicable == null ? '—' : r.applicable ? 'Yes' : 'No')],
            cellText(r.justification),
            cellText(r.applicable ? r.implementation_method : null),
            [text(r.applicable && r.status ? STATUS_LABELS[r.status] : '—')],
          ]),
        ]),
      );
    }

    const plan = rows.filter(inTreatmentPlan);
    content.push(heading(2, '5. Risk Treatment Plan'));
    if (plan.length === 0) {
      content.push(paragraph(text('All applicable controls are implemented; no treatment plan is required.')));
    } else {
      content.push(
        paragraph(text('The following applicable controls are not yet implemented. Progress is monitored by the security manager and reported to top management.')),
        table([
          ['ID', 'Control', 'Implementation method', 'Responsible', 'Deadline', 'Resources', 'Resource approval', 'Status'].map(h => [text(h)]),
          ...plan.map(r => [
            [text(r.control.code)],
            [text(r.control.title)],
            cellText(r.implementation_method),
            [text(person(r.responsible))],
            [text(date(r.deadline))],
            cellText(r.resources),
            [text(!r.resources ? 'Not needed' : r.resources_decision === 'APPROVED' ? `Approved by ${person(r.resources_decider)}` : r.resources_decision === 'REJECTED' ? 'Rejected' : 'Pending')],
            [text(r.status ? STATUS_LABELS[r.status] : '—')],
          ]),
        ]),
      );
    }

    content.push(
      heading(2, '6. Approval by the risk owners'),
      paragraph(text('By approving, the risk owners accept the Risk Treatment Plan and the residual information security risks.')),
      table([
        ['Risk owner', 'Decision', 'Decided by', 'Date', 'Comment'].map(h => [text(h)]),
        ...approvals.map(a => [
          [text(person(a.user))],
          [text(a.decision === 'APPROVED' ? 'Approved' : a.decision === 'REJECTED' ? 'Rejected' : 'Pending')],
          [text(a.decider ? person(a.decider) : '—')],
          [text(date(a.decided_at))],
          cellText(a.comment),
        ]),
      ]),
    );

    return { type: 'doc', content };
  }

  // ─── Completion (enforced by ProjectsService.completeStep) ─────

  async getCompletion(stepId: string) {
    const step = await this.prisma.projectStep.findUnique({
      where: { id: stepId },
      select: { phase_id: true, phase: { select: { project_id: true } } },
    });
    if (!step) throw new NotFoundException('Step not found');
    const access = { stepId, phaseId: step.phase_id, projectId: step.phase.project_id } as Access;

    const [register, rows, approvals, doc, riskStep] = await Promise.all([
      this.prisma.soaRegister.findUnique({ where: { step_id: stepId } }),
      this.getRows(stepId),
      this.getApprovals(access),
      this.prisma.documentInstance.findUnique({ where: { step_id: stepId }, select: { updated_at: true } }),
      this.prisma.projectStep.findUnique({
        where: { phase_id_key: { phase_id: step.phase_id, key: RISK_REGISTER_STEP_KEY } },
        select: { status: true },
      }),
    ]);
    const s = this.summarize(rows);
    const approved = approvals.filter(a => a.decision === 'APPROVED').length;
    const lastChange = [register?.updated_at, ...rows.map(r => r.updated_at), ...approvals.map(a => a.decided_at)]
      .filter((d): d is Date => !!d)
      .reduce<Date | null>((max, d) => (!max || d > max ? d : max), null);
    const docUpToDate = !!doc && (!lastChange || doc.updated_at >= lastChange);

    const items = [
      {
        key: 'risk_register',
        label: 'The Risk Register step is finished',
        done: riskStep?.status === StepStatus.COMPLETED,
        detail: 'Finish the Risk Register first: the SoA must reflect the final risk treatment',
      },
      { key: 'setup', label: 'The SoA setup questions are answered', done: !!register?.setup_completed_at, detail: 'Setup not completed' },
      {
        key: 'decisions',
        label: 'Every control has an applicability decision and a justification',
        done: rows.length > 0 && s.undecided === 0 && s.unjustified === 0,
        detail: `${s.undecided} undecided, ${s.unjustified} without justification`,
      },
      {
        key: 'methods',
        label: 'Every applicable control has an implementation method and status',
        done: rows.length > 0 && s.applicableIncomplete === 0,
        detail: `${s.applicableIncomplete} applicable control(s) incomplete`,
      },
      {
        key: 'plan',
        label: 'The Risk Treatment Plan is complete and confirmed',
        done: rows.length > 0 && s.planIncomplete === 0 && !!register?.rtp_confirmed_at,
        detail: s.planIncomplete > 0 ? `${s.planIncomplete} control(s) without responsible person or deadline` : 'Plan not confirmed (or changed since)',
      },
      {
        key: 'resources',
        label: 'Top management approved all resource requests',
        done: s.resourcesPending === 0 && s.resourcesRejected === 0,
        detail: `${s.resourcesPending} pending, ${s.resourcesRejected} rejected`,
      },
      {
        key: 'owners',
        label: 'Every risk owner approved the plan and the residual risks',
        done: approvals.length > 0 && approved === approvals.length,
        detail: `${approvals.length - approved} of ${approvals.length} approval(s) missing`,
      },
      {
        key: 'document',
        label: 'The Statement of Applicability document is generated and up to date',
        done: docUpToDate,
        detail: doc ? 'The SoA changed after the document was generated; refresh it' : 'Document not generated yet',
      },
    ];
    return { ready: items.every(i => i.done), items };
  }

  // ─── Helpers ───────────────────────────────────────────────────

  private async ensureRows(stepId: string) {
    const controls = await this.prisma.riskControl.findMany({ select: { id: true } });
    await this.prisma.soaControl.createMany({
      data: controls.map(c => ({ step_id: stepId, control_id: c.id })),
      skipDuplicates: true,
    });
  }

  /** Fills rows the user has not edited (or all rows when overwrite) with the platform's suggestion. */
  private async applySuggestions(access: Access, overwrite: boolean) {
    const [rows, suggestions] = await Promise.all([this.getRows(access.stepId), this.computeSuggestions(access)]);
    let applied = 0;
    for (const row of rows) {
      const sug = suggestions.get(row.control.code);
      if (!sug) continue;
      const data: Prisma.SoaControlUpdateInput = { suggestion: sug as unknown as Prisma.InputJsonValue };
      if (overwrite || !row.is_user_edited) {
        data.applicable = sug.applicable;
        data.justification = sug.justification;
        data.implementation_method = sug.applicable ? row.implementation_method ?? sug.method : row.implementation_method;
        if (!sug.applicable) data.status = null;
        if (overwrite) data.is_user_edited = false;
        applied++;
      }
      await this.prisma.soaControl.update({ where: { id: row.id }, data });
    }
    return applied;
  }

  private async computeSuggestions(access: Access) {
    const [register, context] = await Promise.all([
      this.prisma.soaRegister.findUnique({ where: { step_id: access.stepId } }),
      this.getContext(access),
    ]);
    const answers = (register?.setup ?? {}) as Record<string, boolean>;
    const privacyRequirements = context.requirements.filter(r => PRIVACY_PATTERN.test(`${r.label} ${r.description}`));

    const result = new Map<string, Suggestion>();
    for (const [code, entry] of Object.entries(ANNEX_A)) {
      const risks = context.risksByControl.get(code) ?? [];
      const exclusion = SOA_SETUP_QUESTIONS.find(q => answers[q.key] === false && q.excludesWhenNo.includes(code));
      const sources: Suggestion['sources'] = { risks, requirements: [], setup: null };
      let applicable = true;
      let justification = BASELINE_JUSTIFICATION;

      if (risks.length > 0) {
        justification = `Applicable: selected to treat ${risks.length === 1 ? 'risk' : 'risks'} ${risks.map(r => r.ref).join(', ')} in the Risk Register.`;
      } else if (code === 'A.5.31' && context.requirements.length > 0) {
        sources.requirements = context.requirements.map(r => r.label);
        justification = `Applicable: ${context.requirements.length} legal, regulatory or contractual requirement(s) are identified in the Register of Legal, Contractual, and Other Requirements.`;
      } else if (code === 'A.5.34' && privacyRequirements.length > 0) {
        sources.requirements = privacyRequirements.map(r => r.label);
        justification = `Applicable: privacy requirements apply (${privacyRequirements.map(r => r.label).join('; ')}).`;
      } else if (exclusion) {
        applicable = false;
        justification = exclusion.exclusionJustification;
        sources.setup = exclusion.key;
      }
      result.set(code, { applicable, justification, method: applicable ? entry.method : null, sources });
    }
    return result;
  }

  /** Risks and requirements that drive the suggestions, and the risk register status. */
  private async getContext(access: Pick<Access, 'phaseId' | 'projectId'>) {
    const riskStep = await this.prisma.projectStep.findUnique({
      where: { phase_id_key: { phase_id: access.phaseId, key: RISK_REGISTER_STEP_KEY } },
      select: { id: true, status: true },
    });
    const risks = riskStep
      ? await this.prisma.riskItem.findMany({
          where: { step_id: riskStep.id, discarding: false },
          orderBy: { created_at: 'asc' },
          select: {
            treatment_option: true,
            acceptability: true,
            asset: { select: { name: true } },
            threat: { select: { name: true } },
            treatment_controls_link: { select: { control: { select: { code: true } } } },
          },
        })
      : [];

    // Same numbering as the Risk Assessment and Treatment Report (R-001 ...).
    const risksByControl = new Map<string, { ref: string; label: string }[]>();
    risks.forEach((r, i) => {
      if (r.acceptability !== 'NOT_ACCEPTABLE' || r.treatment_option !== 'DECREASE') return;
      const ref = `R-${String(i + 1).padStart(3, '0')}`;
      for (const l of r.treatment_controls_link) {
        const list = risksByControl.get(l.control.code) ?? [];
        list.push({ ref, label: `${r.asset.name}: ${r.threat.name}` });
        risksByControl.set(l.control.code, list);
      }
    });

    const requirements = await this.prisma.requirement.findMany({
      where: { step: { key: REQUIREMENTS_STEP_KEY, phase: { project_id: access.projectId } } },
      select: { interested_party: true, description: true, law_regulation_name: true },
    });

    return {
      risksByControl,
      riskCount: risks.length,
      riskRegisterCompleted: riskStep?.status === StepStatus.COMPLETED,
      requirements: requirements.map(r => ({
        label: r.law_regulation_name?.trim() || r.interested_party,
        description: r.description,
      })),
    };
  }

  private async getRows(stepId: string) {
    const rows = await this.prisma.soaControl.findMany({
      where: { step_id: stepId },
      include: {
        control: { select: { code: true, title: true } },
        responsible: { select: USER_SELECT },
        resources_decider: { select: USER_SELECT },
      },
    });
    return rows.sort((a, b) => compareControlCodes(a.control.code, b.control.code));
  }

  /** Risk owners who must approve; the project leads when the register has no owners. */
  private async getApproverIds(access: Pick<Access, 'phaseId' | 'projectId'>) {
    const riskStep = await this.prisma.projectStep.findUnique({
      where: { phase_id_key: { phase_id: access.phaseId, key: RISK_REGISTER_STEP_KEY } },
      select: { id: true },
    });
    const owners = riskStep
      ? await this.prisma.riskItem.findMany({
          where: { step_id: riskStep.id, discarding: false, risk_owner_id: { not: null } },
          distinct: ['risk_owner_id'],
          select: { risk_owner_id: true },
        })
      : [];
    if (owners.length > 0) return owners.map(o => o.risk_owner_id!);
    const leads = await this.prisma.projectMember.findMany({
      where: { project_id: access.projectId, privilege: ProjectRole.PROJECT_LEAD },
      select: { user_id: true },
    });
    return leads.map(l => l.user_id);
  }

  private async getApprovals(access: Pick<Access, 'stepId' | 'phaseId' | 'projectId'>) {
    const ids = await this.getApproverIds(access);
    const [users, records] = await Promise.all([
      this.prisma.user.findMany({ where: { id: { in: ids } }, select: USER_SELECT }),
      this.prisma.soaOwnerApproval.findMany({
        where: { step_id: access.stepId, user_id: { in: ids } },
        include: { decider: { select: USER_SELECT } },
      }),
    ]);
    return users.map(user => {
      const rec = records.find(r => r.user_id === user.id);
      return {
        user,
        decision: rec?.decision ?? ('PENDING' as const),
        comment: rec?.comment ?? null,
        decider: rec?.decider ?? null,
        decided_at: rec?.decided_at ?? null,
      };
    });
  }

  private summarize(rows: {
    applicable: boolean | null;
    justification: string | null;
    implementation_method: string | null;
    status: ControlImplementationStatus | null;
    responsible_id: string | null;
    deadline: Date | null;
    resources: string | null;
    resources_decision: string | null;
  }[]) {
    const applicable = rows.filter(r => r.applicable === true);
    const plan = rows.filter(inTreatmentPlan);
    const withResources = plan.filter(r => r.resources);
    return {
      total: rows.length,
      undecided: rows.filter(r => r.applicable == null).length,
      unjustified: rows.filter(r => r.applicable != null && !r.justification).length,
      applicable: applicable.length,
      notApplicable: rows.filter(r => r.applicable === false).length,
      implemented: applicable.filter(r => r.status === 'IMPLEMENTED').length,
      planned: plan.length,
      applicableIncomplete: applicable.filter(r => !r.implementation_method || !r.status).length,
      planIncomplete: plan.filter(r => !r.responsible_id || !r.deadline).length,
      resourcesPending: withResources.filter(r => r.resources_decision !== 'APPROVED' && r.resources_decision !== 'REJECTED').length,
      resourcesRejected: withResources.filter(r => r.resources_decision === 'REJECTED').length,
    };
  }

  private async getProjectUsers(projectId: string) {
    const members = await this.prisma.projectMember.findMany({
      where: { project_id: projectId },
      include: { user: { select: USER_SELECT } },
    });
    return members.map(({ user: u, privilege }) => ({
      id: u.id,
      first_name: u.first_name,
      last_name: u.last_name,
      email: u.email,
      privilege,
      label: `${u.first_name} ${u.last_name}`.trim() || u.email,
    }));
  }

  private async log(userId: string, stepId: string, details: Record<string, unknown>, ipAddress?: string, userAgent?: string) {
    await this.auditLog.log({
      userId,
      action: AuditAction.DOCUMENT_UPDATED,
      entityType: 'statement_of_applicability',
      entityId: stepId,
      details: details as never,
      ipAddress,
      userAgent,
    });
  }

  private async ensureAccess(stepId: string, userId: string): Promise<Access> {
    const step = await this.prisma.projectStep.findUnique({
      where: { id: stepId },
      select: {
        id: true,
        phase_id: true,
        phase: {
          select: {
            project_id: true,
            project: {
              select: {
                organization_id: true,
                members: {
                  where: { user_id: userId },
                  select: { privilege: true, iso_roles: { select: { iso_role: true } } },
                },
              },
            },
          },
        },
      },
    });
    if (!step) throw new NotFoundException('Step not found');
    const membership = step.phase.project.members[0];
    if (!membership) throw new ForbiddenException('You are not a member of this project');
    return {
      stepId: step.id,
      phaseId: step.phase_id,
      projectId: step.phase.project_id,
      organizationId: step.phase.project.organization_id,
      role: membership.privilege,
      isTopManagement: membership.iso_roles.some(r => r.iso_role === IsoRole.TOP_MANAGEMENT),
    };
  }

  private async ensureCanEdit(stepId: string, userId: string) {
    const access = await this.ensureAccess(stepId, userId);
    if (access.role === ProjectRole.PROJECT_AUDITOR) {
      throw new ForbiddenException('Auditors have read-only access to the Statement of Applicability');
    }
    return access;
  }
}

function formatDate(d: Date) {
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}
