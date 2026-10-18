import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../common/services/audit-log.service';
import { RiskRegisterService } from '../risk-register/risk-register.service';
import { SoaService } from '../soa/soa.service';
import { PoliciesService } from '../policies/policies.service';
import { TrainingsService } from '../audit-prep/trainings.service';
import { ObjectivesService } from '../audit-prep/objectives.service';
import { InternalAuditService } from '../audit-prep/internal-audit.service';
import { ManagementReviewService } from '../audit-prep/management-review.service';
import { P4 } from '../audit-prep/keys';
import { withProgress } from './project-progress';
import { MaintenanceService, MAINTENANCE_STEP_KEY } from '../maintenance/maintenance.service';
import { TasksService } from '../tasks/tasks.service';
import {
  CreateProjectDto,
  UpdateProjectDto,
  SendAwarenessDto,
  ConfirmTrainingDto,
} from './dto/project.dto';
import {
  ProjectRole,
  OrganizationRole,
  AuditAction,
  FrameworkStatus,
  StepType,
  StepStatus,
  TaskType,
  Prisma,
} from '@prisma/client';

const FRAMEWORK_SELECT = {
  id: true,
  code: true,
  name: true,
  description: true,
  version: true,
  status: true,
} as const;

const DEFAULT_PHASES = [
  { name: 'Project Preparation', description: 'Prepare the ISMS project: align the team, set scope foundations and governance basics', order: 1 },
  { name: 'Risk Management', description: 'Assess information security risks, decide how to treat them and which controls apply', order: 2 },
  // Conformio: Phase 3 steps are added automatically from the Statement of Applicability.
  { name: 'Security Documentation', description: 'Write the security policies and procedures required by the Statement of Applicability', order: 3 },
  { name: 'Preparation for External Audit', description: 'Run the ISMS and produce the evidence the certification auditor will check: trainings, objectives, internal audit and management review', order: 4 },
  { name: 'ISMS Maintenance & Certification Cycle', description: 'Keep the ISMS running after certification: recurring reviews, audits and certification dates', order: 5 },
];

/**
 * Steps seeded into Phase 1 (Project Preparation). Must stay in sync with
 * the migration backfill for pre-existing projects.
 */
const PHASE_1_STEPS = [
  {
    key: 'iso27001.p1s1.intro',
    title: 'Introduction to the ISO 27001 Implementation Process',
    purpose:
      'Align leadership and the project team on what implementing ISO 27001 involves before any working steps begin.',
    type: StepType.EDUCATIONAL,
    order: 1,
    metadata_json: { clause: 'Not required by the standard' },
  },
  {
    key: 'iso27001.p1s2.doc-control',
    title: 'Procedure for Document and Record Control',
    purpose:
      'Define how documents and records are governed: creation, approval, publishing, distribution and withdrawal.',
    type: StepType.DOCUMENT,
    order: 2,
    metadata_json: { clause: 'Clause 7.5', workload_hours: 1, estimated_days: 2, mandatory: false },
  },
  {
    key: 'iso27001.p1s3.project-plan',
    title: 'Project Plan for ISMS Implementation',
    purpose:
      'Define the ISMS implementation objectives, deliverables, deadlines, responsibilities, project risks, and project management arrangements.',
    type: StepType.DOCUMENT,
    order: 3,
    metadata_json: { clause: 'Not required by the standard', workload_hours: 4, estimated_days: 2, mandatory: false },
  },
  {
    key: 'iso27001.p1s4.req-identification',
    title: 'Procedure for Identification of Requirements',
    purpose:
      'Define the process of identification of interested parties, statutory, regulatory, contractual and other requirements related to information security, and responsibilities for their fulfillment.',
    type: StepType.DOCUMENT,
    order: 4,
    metadata_json: { clause: 'Clause 4.2 and control A.5.31', workload_hours: 1, estimated_days: 2, mandatory: false },
  },
  {
    key: 'iso27001.p1s5.legal-requirements',
    title: 'Register of Legal, Contractual, and Other Requirements',
    purpose:
      'List all relevant interested parties and define what they expect from your security — this way you will know how to configure further documents and activities.',
    type: StepType.REGISTER,
    order: 5,
    metadata_json: { clause: 'Clause 4.2 and control A.5.31', workload_hours: 6, estimated_days: 4, mandatory: true },
  },
  {
    key: 'iso27001.p1s6.isms-scope',
    title: 'ISMS Scope Document',
    purpose:
      'Define the boundaries of the ISMS — which departments, processes, locations, and IT infrastructure are covered.',
    type: StepType.DOCUMENT,
    order: 6,
    metadata_json: { clause: 'Clause 4.3', workload_hours: 4, estimated_days: 2, mandatory: true },
  },
  {
    key: 'iso27001.p1s7.security-policy',
    title: 'Information Security Policy',
    purpose:
      'Define the top-level policy for information security management — purpose, direction, principles and basic rules for the ISMS.',
    type: StepType.DOCUMENT,
    order: 7,
    metadata_json: { clause: 'Clauses 5.2 and 5.3', workload_hours: 4, estimated_days: 2, mandatory: true },
  },
  {
    key: 'iso27001.p1s8.security-awareness',
    title: 'Information Security Awareness',
    purpose:
      'Understand what security awareness training should cover, how to deliver it, and what evidence to maintain for audit.',
    type: StepType.EDUCATIONAL,
    order: 8,
    metadata_json: { clause: 'Clause 7.3 and control A.6.3' },
  },
];

const RISK_REGISTER_STEP_KEY = 'iso27001.p2s2.risk-register';
const REQUIREMENTS_STEP_KEY = 'iso27001.p1s5.legal-requirements';

/** Phase 5: Conformio's maintenance module (certification cycle and recurring activities). */
const PHASE_5_STEPS = [
  {
    key: MAINTENANCE_STEP_KEY,
    title: 'ISMS Maintenance & Certification Cycle',
    purpose: 'Keep the ISMS running after certification: track the certification cycle and perform the recurring reviews, audits and management reviews on time.',
    type: StepType.REGISTER,
    order: 1,
    metadata_json: { clause: 'Clauses 9.1, 9.2, 9.3 and 10.1', mandatory: true },
  },
];

/** Phase 4 (Preparation for External Audit), in Conformio's order. */
const PROCEDURE_OPTIONAL = 'This document is not mandatory, so if you do not see a benefit in using it, you can skip it.';
const PHASE_4_STEPS = [
  {
    key: P4.NC_PROCEDURE,
    title: 'Procedure for Nonconformities and Corrective Actions',
    purpose: 'Describe all activities related to corrective actions and the use of the Nonconformity and Corrective Action registers.',
    type: StepType.DOCUMENT,
    order: 1,
    metadata_json: { clause: 'Clauses 10.1 and 10.2', workload_hours: 1.5, estimated_days: 1, mandatory: false, policy_key: 'nonconformity-procedure', why: PROCEDURE_OPTIONAL },
  },
  {
    key: P4.AUDIT_PROCEDURE,
    title: 'Internal Audit Procedure',
    purpose: 'Describe all audit related activities: writing the audit programme, selecting an auditor, conducting individual audits and reporting.',
    type: StepType.DOCUMENT,
    order: 2,
    metadata_json: { clause: 'Clause 9.2', workload_hours: 1.5, estimated_days: 1, mandatory: false, policy_key: 'internal-audit-procedure', why: PROCEDURE_OPTIONAL },
  },
  {
    key: P4.TRAINING_PLAN,
    title: 'Initial Training Plan',
    purpose: 'Define which people will need to attend which security trainings, and keep the record of trainings performed.',
    type: StepType.REGISTER,
    order: 3,
    metadata_json: { clause: 'Clause 7.2 and control A.6.3', workload_hours: 0.5, estimated_days: 1, mandatory: true },
  },
  {
    key: P4.OBJECTIVES,
    title: 'Setting Up Security Objectives',
    purpose: 'Set up the information security objectives, who is responsible for them and how they are measured.',
    type: StepType.REGISTER,
    order: 4,
    metadata_json: { clause: 'Clauses 6.2 and 9.1', workload_hours: 1.5, estimated_days: 1, mandatory: true },
  },
  {
    key: P4.REVIEW_SETUP,
    title: 'Setting Up Management Review',
    purpose: 'Set up how top management controls what is being done with security: what is reviewed, by whom and how often.',
    type: StepType.REGISTER,
    order: 5,
    metadata_json: { clause: 'Clauses 5.1, 5.3, and 9.3', workload_hours: 0.5, estimated_days: 1, mandatory: true },
  },
  {
    key: P4.INTERNAL_AUDIT,
    title: 'Internal Audit',
    purpose: 'Plan and perform the internal audit using a checklist of the ISO 27001 requirements and your applicable controls, and report the results.',
    type: StepType.REGISTER,
    order: 6,
    metadata_json: { clause: 'Clauses 9.2 and 10.1', workload_hours: 9, estimated_days: 1, mandatory: true },
  },
  {
    key: P4.MANAGEMENT_REVIEW,
    title: 'First Official Management Review',
    purpose: 'Provide top management with crucial information about security, and ask them for key decisions.',
    type: StepType.REGISTER,
    order: 7,
    metadata_json: { clause: 'Clauses 5.1, 9.3, 10.1, and 10.2', workload_hours: 1, estimated_days: 1, mandatory: true },
  },
];
const SOA_STEP_KEY = 'iso27001.p2s3.statement-of-applicability';

const PHASE_2_STEPS = [
  {
    key: 'iso27001.p2s1.risk-methodology',
    title: 'Risk Assessment and Risk Treatment Methodology',
    purpose:
      'Define the methodology for assessment and treatment of information risks, and the acceptable level of risk.',
    type: StepType.DOCUMENT,
    order: 1,
    metadata_json: { clause: 'Clauses 6.1, 8.2, and 8.3', workload_hours: 4, estimated_days: 3, mandatory: true },
  },
  {
    key: 'iso27001.p2s2.risk-register',
    title: 'Risk Register',
    purpose:
      'List the risks to your information, assess their impact and likelihood, and manage them through treatment and approval.',
    type: StepType.REGISTER,
    order: 2,
    // Conformio: 4 h to fill out the register + 2 h for review and approval; usually 4 days.
    metadata_json: {
      clause: 'Clauses 6.1, 8.2, and 8.3',
      workload_hours: 6,
      estimated_days: 4,
      mandatory: true,
    },
  },
  {
    key: SOA_STEP_KEY,
    title: 'Statement of Applicability',
    purpose:
      'List which controls are appropriate to be implemented, why, and how they are implemented, and plan the implementation of the controls that are not yet in place (Risk Treatment Plan).',
    type: StepType.REGISTER,
    order: 3,
    // Conformio: 4 h to fill out the register + 1 h for review and approval; usually 2 days.
    metadata_json: {
      clause: 'Clauses 6.1.3 d), 6.1.3 e), 6.2, and 8.3',
      workload_hours: 5,
      estimated_days: 2,
      mandatory: true,
    },
  },
];

const STEP_INCLUDE = {
  document_instance: {
    select: {
      id: true,
      status: true,
      version: true,
      updated_at: true,
      deadline: true,
      update_interval: true,
      code: true,
      confidentiality: true,
      owner_id: true,
      reviewer_id: true,
      approver_id: true,
      owner: { select: { id: true, first_name: true, last_name: true, email: true } },
      reviewer: { select: { id: true, first_name: true, last_name: true, email: true } },
      approver: { select: { id: true, first_name: true, last_name: true, email: true } },
      _count: { select: { versions: true } },
    },
  },
} as const;

@Injectable()
export class ProjectsService {
  private readonly logger = new Logger(ProjectsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
    private readonly riskRegister: RiskRegisterService,
    private readonly soa: SoaService,
    private readonly tasks: TasksService,
    private readonly policies: PoliciesService,
    private readonly trainings: TrainingsService,
    private readonly objectives: ObjectivesService,
    private readonly audits: InternalAuditService,
    private readonly reviews: ManagementReviewService,
    private readonly maintenance: MaintenanceService,
  ) {}

  async create(
    orgId: string,
    dto: CreateProjectDto,
    userId: string,
    userRole: OrganizationRole,
    ipAddress?: string,
    userAgent?: string,
  ) {
    if (
      userRole !== OrganizationRole.ORG_OWNER &&
      userRole !== OrganizationRole.ORG_ADMIN
    ) {
      throw new ForbiddenException('Only owners and admins can create projects');
    }

    this.validateDateRange(dto.start_date, dto.target_date);

    const framework = await this.prisma.complianceFramework.findUnique({
      where: { id: dto.framework_id },
    });

    if (!framework || framework.status !== FrameworkStatus.AVAILABLE) {
      throw new BadRequestException('Selected compliance framework is not available');
    }

    const project = await this.prisma.complianceProject.create({
      data: {
        organization_id: orgId,
        name: dto.name,
        description: dto.description,
        status: dto.status,
        start_date: new Date(dto.start_date),
        target_date: new Date(dto.target_date),
        compliance_framework_id: framework.id,
        created_by: userId,
        members: {
          create: {
            user_id: userId,
            privilege: ProjectRole.PROJECT_LEAD,
          },
        },
        phases: {
          create: DEFAULT_PHASES.map((phase) => {
            if (phase.order === 1) return { ...phase, steps: { create: PHASE_1_STEPS } };
            if (phase.order === 2) return { ...phase, steps: { create: PHASE_2_STEPS } };
            if (phase.order === 4) return { ...phase, steps: { create: PHASE_4_STEPS } };
            if (phase.order === 5) return { ...phase, steps: { create: PHASE_5_STEPS } };
            return { ...phase };
          }),
        },
      },
      include: {
        compliance_framework: { select: FRAMEWORK_SELECT },
        members: {
          include: {
            user: {
              select: { id: true, email: true, first_name: true, last_name: true },
            },
            iso_roles: true,
          },
        },
        phases: {
          orderBy: { order: 'asc' },
          include: { steps: { orderBy: { order: 'asc' }, include: STEP_INCLUDE } },
        },
      },
    });

    await this.auditLog.log({
      userId,
      action: AuditAction.PROJECT_CREATED,
      entityType: 'compliance_project',
      entityId: project.id,
      details: { organizationId: orgId, name: project.name },
      ipAddress,
      userAgent,
    });

    return withProgress(this.prisma, project);
  }

  /**
   * Ensures target date is not before start date. Date-only ISO strings are
   * parsed as UTC midnight on both sides, so comparison stays timezone-safe.
   */
  private validateDateRange(
    startDate?: string | null,
    targetDate?: string | null,
  ): void {
    if (!startDate || !targetDate) return;
    if (new Date(targetDate) < new Date(startDate)) {
      throw new BadRequestException('Target date must be on or after the start date.');
    }
  }

  async findAllForOrg(orgId: string, userId: string) {
    const isMember = await this.prisma.organizationMember.findUnique({
      where: {
        organization_id_user_id: {
          organization_id: orgId,
          user_id: userId,
        },
      },
    });

    if (!isMember) {
      throw new NotFoundException('Organization not found');
    }

    const projects = await this.prisma.complianceProject.findMany({
      where: { organization_id: orgId },
      include: {
        compliance_framework: { select: FRAMEWORK_SELECT },
        phases: {
          orderBy: { order: 'asc' },
          select: { id: true, order: true, name: true, steps: { select: { id: true, key: true, status: true, completion_data: true } } },
        },
        _count: {
          select: { members: true, phases: true },
        },
      },
      orderBy: { created_at: 'desc' },
    });
    // The list only needs each phase's progress, not its steps.
    return Promise.all(projects.map(async (project) => {
      const withSteps = await withProgress(this.prisma, project);
      return { ...withSteps, phases: withSteps.phases.map(({ steps: _steps, ...phase }) => phase) };
    }));
  }

  async findOne(projectId: string, userId: string) {
    const project = await this.prisma.complianceProject.findUnique({
      where: { id: projectId },
      include: {
        organization: {
          select: { id: true, name: true },
        },
        compliance_framework: { select: FRAMEWORK_SELECT },
        members: {
          include: {
            user: {
              select: { id: true, email: true, first_name: true, last_name: true },
            },
            iso_roles: true,
          },
        },
        phases: {
          orderBy: { order: 'asc' },
          include: { steps: { orderBy: { order: 'asc' }, include: STEP_INCLUDE } },
        },
        _count: {
          select: { members: true, phases: true },
        },
      },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    const isOrgMember = await this.prisma.organizationMember.findUnique({
      where: {
        organization_id_user_id: {
          organization_id: project.organization_id,
          user_id: userId,
        },
      },
    });

    if (!isOrgMember) {
      throw new NotFoundException('Project not found');
    }

    return withProgress(this.prisma, project);
  }

  async update(
    projectId: string,
    dto: UpdateProjectDto,
    userId: string,
    userRole: ProjectRole,
    ipAddress?: string,
    userAgent?: string,
  ) {
    if (userRole !== ProjectRole.PROJECT_LEAD) {
      throw new ForbiddenException('Only the project lead can update the project');
    }

    const project = await this.prisma.complianceProject.findUnique({
      where: { id: projectId },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    const effectiveStartDate =
      dto.start_date !== undefined ? dto.start_date : project.start_date?.toISOString();
    const effectiveTargetDate =
      dto.target_date !== undefined ? dto.target_date : project.target_date?.toISOString();
    this.validateDateRange(effectiveStartDate, effectiveTargetDate);

    const updated = await this.prisma.complianceProject.update({
      where: { id: projectId },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.status !== undefined && { status: dto.status }),
        ...(dto.start_date !== undefined && { start_date: new Date(dto.start_date) }),
        ...(dto.target_date !== undefined && { target_date: new Date(dto.target_date) }),
      },
      include: {
        compliance_framework: { select: FRAMEWORK_SELECT },
      },
    });

    await this.auditLog.log({
      userId,
      action: AuditAction.PROJECT_UPDATED,
      entityType: 'compliance_project',
      entityId: projectId,
      details: { changes: dto as any },
      ipAddress,
      userAgent,
    });

    return updated;
  }

  async remove(
    projectId: string,
    userId: string,
    userRole: ProjectRole,
    ipAddress?: string,
    userAgent?: string,
  ) {
    if (userRole !== ProjectRole.PROJECT_LEAD) {
      throw new ForbiddenException('Only the project lead can delete the project');
    }

    const project = await this.prisma.complianceProject.findUnique({
      where: { id: projectId },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    await this.prisma.complianceProject.delete({ where: { id: projectId } });

    await this.auditLog.log({
      userId,
      action: AuditAction.PROJECT_DELETED,
      entityType: 'compliance_project',
      entityId: projectId,
      details: { name: project.name, organizationId: project.organization_id },
      ipAddress,
      userAgent,
    });

    return { message: 'Project deleted successfully' };
  }

  async completeStep(
    projectId: string,
    stepId: string,
    userId: string,
    userRole: ProjectRole,
    skip = false,
    ipAddress?: string,
    userAgent?: string,
  ) {
    if (
      userRole !== ProjectRole.PROJECT_LEAD &&
      userRole !== ProjectRole.PROJECT_MEMBER
    ) {
      throw new ForbiddenException('Only project members can complete steps');
    }

    const step = await this.prisma.projectStep.findUnique({
      where: { id: stepId },
      include: {
        phase: { select: { project_id: true, name: true } },
        document_instance: { select: { _count: { select: { versions: true } } } },
        _count: { select: { requirements: true } },
      },
    });

    if (!step || step.phase.project_id !== projectId) {
      throw new NotFoundException('Step not found');
    }
    if (step.status === StepStatus.COMPLETED) {
      throw new BadRequestException('This step is already completed');
    }

    const meta = (step.metadata_json ?? {}) as { mandatory?: boolean };
    if (skip) {
      // Only suggested steps can be skipped; the decision is kept with the step.
      if (meta.mandatory) throw new BadRequestException('This step is mandatory for ISO 27001 and cannot be skipped');
      await this.mergeCompletionData(stepId, { proceed: false, skipped: true });
    } else if (step.type === StepType.DOCUMENT && !step.document_instance?._count.versions) {
      // Clause 7.5.2-7.5.3: the document must be approved and available, i.e. in the library.
      throw new BadRequestException('Submit the document of this step to the library before finishing the step');
    } else if (step.key === REQUIREMENTS_STEP_KEY && step._count.requirements === 0) {
      throw new BadRequestException('Add at least one requirement of an interested party (clause 4.2) before finishing the step');
    }

    // The risk register is only complete when the risks are assessed, treated
    // and accepted by their owners (clauses 6.1.2, 6.1.3 f, 8.2 and 8.3).
    // Registers are only complete when their checklist is: the risk register
    // (clauses 6.1.2, 6.1.3 f, 8.2, 8.3) and the SoA (clauses 6.1.3 d-f, 8.3).
    const completionProviders: Record<string, (id: string) => Promise<{ ready: boolean; items: { label: string; done: boolean; detail: string }[] }>> = {
      [RISK_REGISTER_STEP_KEY]: id => this.riskRegister.getCompletion(id),
      [SOA_STEP_KEY]: id => this.soa.getCompletion(id),
      [P4.TRAINING_PLAN]: id => this.trainings.getCompletion(id),
      [P4.OBJECTIVES]: id => this.objectives.getCompletion(id),
      [P4.REVIEW_SETUP]: id => this.reviews.getSetupCompletion(id),
      [P4.INTERNAL_AUDIT]: id => this.audits.getCompletion(id),
      [P4.MANAGEMENT_REVIEW]: id => this.reviews.getReviewCompletion(id),
      [MAINTENANCE_STEP_KEY]: id => this.maintenance.getCompletion(id),
    };
    const checklist = completionProviders[step.key] ? await completionProviders[step.key](stepId) : null;
    if (checklist && !checklist.ready) {
      const missing = checklist.items.filter(i => !i.done).map(i => `${i.label} (${i.detail})`);
      throw new BadRequestException(`${step.title} is not complete yet: ${missing.join('; ')}`);
    }

    const updated = await this.prisma.projectStep.update({
      where: { id: stepId },
      data: { status: StepStatus.COMPLETED, completed_at: new Date() },
    });

    if (step.key === RISK_REGISTER_STEP_KEY) {
      await this.tasks.scheduleRiskReview(projectId, stepId, userId);
    }
    // Finishing the SoA adds the required policies to Phase 3 (Security Documentation).
    if (step.key === SOA_STEP_KEY) {
      await this.policies.syncFromSoa(stepId, userId);
    }
    // After the first management review the ISMS runs: start the maintenance cycle (Phase 5).
    if (step.key === P4.MANAGEMENT_REVIEW) {
      await this.maintenance.ensureSetup(projectId);
      await this.maintenance.runForProject(projectId);
    }

    // Starting real implementation work moves the project out of planning.
    await this.prisma.complianceProject.updateMany({
      where: { id: projectId, status: 'PLANNING' },
      data: { status: 'IN_PROGRESS' },
    });


    await this.auditLog.log({
      userId,
      action: AuditAction.STEP_COMPLETED,
      entityType: 'project_step',
      entityId: stepId,
      details: {
        projectId,
        phaseName: step.phase.name,
        stepKey: step.key,
        stepTitle: step.title,
      },
      ipAddress,
      userAgent,
    });

    return updated;
  }

  /**
   * A completed step can be reopened by the project lead, for example when
   * the scope changes. Its records stay as they are; it only has to be finished again.
   */
  async reopenStep(projectId: string, stepId: string, userId: string, ipAddress?: string, userAgent?: string) {
    const step = await this.prisma.projectStep.findUnique({ where: { id: stepId }, include: { phase: { select: { project_id: true } } } });
    if (!step || step.phase.project_id !== projectId) throw new NotFoundException('Step not found');
    if (step.status !== StepStatus.COMPLETED) throw new BadRequestException('Only a completed step can be reopened');

    const data = (step.completion_data ?? {}) as Record<string, unknown>;
    const { skipped: _skipped, proceed: _proceed, ...rest } = data;
    const reopened = await this.prisma.projectStep.update({
      where: { id: stepId },
      data: { status: StepStatus.NOT_STARTED, completed_at: null, completion_data: (data.skipped ? rest : data) as Prisma.InputJsonValue },
    });
    await this.auditLog.log({
      userId,
      action: AuditAction.STEP_COMPLETED,
      entityType: 'project_step',
      entityId: stepId,
      details: { projectId, stepKey: step.key, stepTitle: step.title, action: 'reopened' },
      ipAddress,
      userAgent,
    });
    return reopened;
  }

  async addProjectMember(
    projectId: string,
    email: string,
    privilege: ProjectRole,
    customRole: string | undefined,
    userId: string,
    userRole: ProjectRole,
    ipAddress?: string,
    userAgent?: string,
  ) {
    if (userRole !== ProjectRole.PROJECT_LEAD) {
      throw new ForbiddenException('Only the project lead can add members');
    }

    const userToAdd = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!userToAdd) {
      throw new NotFoundException('User not found');
    }

    const project = await this.prisma.complianceProject.findUnique({
      where: { id: projectId },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    const isOrgMember = await this.prisma.organizationMember.findUnique({
      where: {
        organization_id_user_id: {
          organization_id: project.organization_id,
          user_id: userToAdd.id,
        },
      },
    });

    if (!isOrgMember) {
      throw new ForbiddenException('User must be a member of the organization first');
    }

    const existing = await this.prisma.projectMember.findUnique({
      where: {
        project_id_user_id: {
          project_id: projectId,
          user_id: userToAdd.id,
        },
      },
    });

    if (existing) {
      throw new ForbiddenException('User is already a member of this project');
    }

    const member = await this.prisma.projectMember.create({
      data: {
        project_id: projectId,
        user_id: userToAdd.id,
        privilege,
        custom_role: customRole,
      },
      include: {
        user: {
          select: { id: true, email: true, first_name: true, last_name: true },
        },
        iso_roles: true,
      },
    });

    await this.auditLog.log({
      userId,
      action: AuditAction.PROJECT_MEMBER_ADDED,
      entityType: 'project_member',
      entityId: member.id,
      details: { projectId, addedUserId: userToAdd.id, privilege },
      ipAddress,
      userAgent,
    });

    return member;
  }

  async removeProjectMember(
    projectId: string,
    memberId: string,
    userId: string,
    userRole: ProjectRole,
    ipAddress?: string,
    userAgent?: string,
  ) {
    if (userRole !== ProjectRole.PROJECT_LEAD) {
      throw new ForbiddenException('Only the project lead can remove members');
    }

    const membership = await this.prisma.projectMember.findUnique({
      where: { id: memberId },
    });

    if (!membership || membership.project_id !== projectId) {
      throw new NotFoundException('Member not found');
    }

    await this.prisma.projectMember.delete({ where: { id: memberId } });

    await this.auditLog.log({
      userId,
      action: AuditAction.PROJECT_MEMBER_REMOVED,
      entityType: 'project_member',
      entityId: memberId,
      details: { projectId, removedUserId: membership.user_id },
      ipAddress,
      userAgent,
    });

    return { message: 'Member removed successfully' };
  }

  async assignIsoRoles(
    projectId: string,
    memberId: string,
    isoRoles: string[],
    userId: string,
    userRole: ProjectRole,
  ) {
    if (userRole !== ProjectRole.PROJECT_LEAD) {
      throw new ForbiddenException('Only the project lead can assign ISO roles');
    }

    const membership = await this.prisma.projectMember.findUnique({
      where: { id: memberId },
    });

    if (!membership || membership.project_id !== projectId) {
      throw new NotFoundException('Member not found');
    }

    await this.prisma.projectMemberIsoRole.deleteMany({
      where: { project_member_id: memberId },
    });

    if (isoRoles.length > 0) {
      await this.prisma.projectMemberIsoRole.createMany({
        data: isoRoles.map((role) => ({
          project_member_id: memberId,
          iso_role: role as any,
        })),
      });
    }

    return this.prisma.projectMember.findUnique({
      where: { id: memberId },
      include: { iso_roles: true },
    });
  }

  async updateStepCompletionData(
    projectId: string,
    stepId: string,
    completionData: Record<string, unknown>,
    userId: string,
    userRole: ProjectRole,
  ) {
    if (
      userRole !== ProjectRole.PROJECT_LEAD &&
      userRole !== ProjectRole.PROJECT_MEMBER
    ) {
      throw new ForbiddenException('Only project members can update step data');
    }

    const step = await this.prisma.projectStep.findUnique({
      where: { id: stepId },
      include: { phase: { select: { project_id: true } } },
    });

    if (!step || step.phase.project_id !== projectId) {
      throw new NotFoundException('Step not found');
    }

    return this.prisma.projectStep.update({
      where: { id: stepId },
      data: { completion_data: completionData as Prisma.InputJsonValue },
    });
  }

  // ─── Awareness and training for a step (clauses 7.2 and 7.3) ──

  /** "Send materials": one awareness task per person, listing the materials. */
  async sendAwareness(
    projectId: string,
    stepId: string,
    dto: SendAwarenessDto,
    userId: string,
    userRole: ProjectRole,
    ipAddress?: string,
    userAgent?: string,
  ) {
    const { step, organizationId } = await this.getEditableStep(projectId, stepId, userRole);
    await this.assertMembers(projectId, dto.user_ids);

    const notes = [
      `Awareness materials for "${step.title}":`,
      ...dto.materials.map(m => `- ${m.title}${m.url ? ` (${m.url})` : ''}`),
    ].join('\n');
    for (const assignee of new Set(dto.user_ids)) {
      await this.tasks.create(
        { projectId, organizationId, stepId, assignedTo: assignee, assignedBy: userId,
          type: TaskType.AWARENESS_TASK, notes, deadline: null },
        ipAddress,
        userAgent,
      );
    }

    return this.mergeCompletionData(stepId, {
      awareness: {
        materials: dto.materials,
        user_ids: [...new Set(dto.user_ids)],
        sent_by: userId,
        sent_at: new Date().toISOString(),
      },
      needs_awareness: true,
    });
  }

  /** Training "Confirm": one training task per row (name, skills, training). */
  async confirmTraining(
    projectId: string,
    stepId: string,
    dto: ConfirmTrainingDto,
    userId: string,
    userRole: ProjectRole,
    ipAddress?: string,
    userAgent?: string,
  ) {
    const { step, organizationId } = await this.getEditableStep(projectId, stepId, userRole);
    await this.assertMembers(projectId, dto.rows.map(r => r.user_id));

    for (const r of dto.rows) {
      const notes = [
        `Training needed for "${step.title}".`,
        `Required knowledge and skills: ${r.skills}`,
        r.training ? `Training: ${r.training}` : null,
      ].filter(Boolean).join('\n');
      await this.tasks.create(
        { projectId, organizationId, stepId, assignedTo: r.user_id, assignedBy: userId,
          type: TaskType.TRAINING_TASK, notes, deadline: null },
        ipAddress,
        userAgent,
      );
    }

    return this.mergeCompletionData(stepId, {
      training: {
        rows: dto.rows,
        confirmed_by: userId,
        confirmed_at: new Date().toISOString(),
      },
      needs_training: dto.rows.length > 0,
    });
  }

  private async getEditableStep(projectId: string, stepId: string, userRole: ProjectRole) {
    if (userRole !== ProjectRole.PROJECT_LEAD && userRole !== ProjectRole.PROJECT_MEMBER) {
      throw new ForbiddenException('Only project leads and members can do this');
    }
    const step = await this.prisma.projectStep.findUnique({
      where: { id: stepId },
      include: { phase: { select: { project_id: true, project: { select: { organization_id: true } } } } },
    });
    if (!step || step.phase.project_id !== projectId) throw new NotFoundException('Step not found');
    return { step, organizationId: step.phase.project.organization_id };
  }

  private async assertMembers(projectId: string, userIds: string[]) {
    const unique = [...new Set(userIds)];
    const count = await this.prisma.projectMember.count({
      where: { project_id: projectId, user_id: { in: unique } },
    });
    if (count !== unique.length) throw new BadRequestException('Everyone selected must be a member of this project');
  }

  /** Merges into completion_data on the server so concurrent sections don't overwrite each other. */
  private async mergeCompletionData(stepId: string, updates: Record<string, unknown>) {
    const step = await this.prisma.projectStep.findUnique({ where: { id: stepId }, select: { completion_data: true } });
    const current = (step?.completion_data ?? {}) as Record<string, unknown>;
    return this.prisma.projectStep.update({
      where: { id: stepId },
      data: { completion_data: { ...current, ...updates } as Prisma.InputJsonValue },
    });
  }
}
