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
import {
  CreateProjectDto,
  UpdateProjectDto,
  UpdatePhaseDto,
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
  NotificationType,
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
  { name: 'Risk Assessment', description: 'Identify and evaluate information security risks', order: 2 },
  { name: 'Control Selection', description: 'Select appropriate security controls from Annex A', order: 3 },
  { name: 'Implementation', description: 'Implement selected controls and document policies', order: 4 },
  { name: 'Internal Audit', description: 'Conduct internal audit of the ISMS', order: 5 },
  { name: 'Management Review', description: 'Management review of ISMS performance', order: 6 },
  { name: 'Certification Readiness', description: 'Prepare for external certification audit', order: 7 },
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
    metadata_json: { clause: 'Clause 7.2.2' },
  },
];

const RISK_REGISTER_STEP_KEY = 'iso27001.p2s2.risk-register';

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
      owner_id: true,
      reviewer_id: true,
      approver_id: true,
      owner: { select: { id: true, first_name: true, last_name: true, email: true } },
      reviewer: { select: { id: true, first_name: true, last_name: true, email: true } },
      approver: { select: { id: true, first_name: true, last_name: true, email: true } },
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

    return project;
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

    return this.prisma.complianceProject.findMany({
      where: { organization_id: orgId },
      include: {
        compliance_framework: { select: FRAMEWORK_SELECT },
        phases: {
          orderBy: { order: 'asc' },
          select: { id: true, order: true, status: true },
        },
        _count: {
          select: { members: true, phases: true },
        },
      },
      orderBy: { created_at: 'desc' },
    });
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

    return project;
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

  async updatePhase(
    projectId: string,
    phaseId: string,
    dto: UpdatePhaseDto,
    userId: string,
    userRole: ProjectRole,
    ipAddress?: string,
    userAgent?: string,
  ) {
    if (
      userRole !== ProjectRole.PROJECT_LEAD &&
      userRole !== ProjectRole.PROJECT_AUDITOR
    ) {
      throw new ForbiddenException('Only leads and auditors can update phases');
    }

    const phase = await this.prisma.projectPhase.findUnique({
      where: { id: phaseId },
    });

    if (!phase || phase.project_id !== projectId) {
      throw new NotFoundException('Phase not found');
    }

    const updateData: any = { status: dto.status };

    if (dto.status === 'IN_PROGRESS' && !phase.started_at) {
      updateData.started_at = new Date();
    }

    if (dto.status === 'COMPLETED' && !phase.completed_at) {
      updateData.completed_at = new Date();
    }

    const updated = await this.prisma.projectPhase.update({
      where: { id: phaseId },
      data: updateData,
    });

    await this.auditLog.log({
      userId,
      action: AuditAction.PHASE_UPDATED,
      entityType: 'project_phase',
      entityId: phaseId,
      details: { projectId, phaseName: phase.name, oldStatus: phase.status, newStatus: dto.status },
      ipAddress,
      userAgent,
    });

    return updated;
  }

  async completeStep(
    projectId: string,
    stepId: string,
    userId: string,
    userRole: ProjectRole,
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
      include: { phase: { select: { project_id: true, name: true } } },
    });

    if (!step || step.phase.project_id !== projectId) {
      throw new NotFoundException('Step not found');
    }

    // The risk register is only complete when the risks are assessed, treated
    // and accepted by their owners (clauses 6.1.2, 6.1.3 f, 8.2 and 8.3).
    if (step.key === RISK_REGISTER_STEP_KEY) {
      const completion = await this.riskRegister.getCompletion(stepId);
      if (!completion.ready) {
        const missing = completion.items.filter(i => !i.done).map(i => `${i.label} (${i.detail})`);
        throw new BadRequestException(`The risk register is not complete yet: ${missing.join('; ')}`);
      }
    }

    const updated = await this.prisma.projectStep.update({
      where: { id: stepId },
      data: { status: StepStatus.COMPLETED, completed_at: new Date() },
    });

    if (step.key === RISK_REGISTER_STEP_KEY) {
      await this.scheduleRiskReview(projectId, stepId, userId);
    }

    // Derive the phase state from its steps: starting a step starts the
    // phase; finishing the last step finishes it.
    const phaseWithSteps = await this.prisma.projectPhase.findUnique({
      where: { id: step.phase_id },
      include: { steps: { select: { status: true } } },
    });

    let phaseStatus = phaseWithSteps?.status;
    if (phaseWithSteps) {
      const allStepsDone =
        phaseWithSteps.steps.length > 0 &&
        phaseWithSteps.steps.every((s) => s.status === StepStatus.COMPLETED);
      const nextPhaseData: {
        status?: typeof phaseStatus;
        started_at?: Date;
        completed_at?: Date;
      } = {};
      if (phaseWithSteps.status === 'NOT_STARTED') {
        nextPhaseData.status = allStepsDone ? 'COMPLETED' : 'IN_PROGRESS';
        nextPhaseData.started_at = new Date();
      } else if (
        phaseWithSteps.status === 'IN_PROGRESS' &&
        allStepsDone
      ) {
        nextPhaseData.status = 'COMPLETED';
      }
      if (nextPhaseData.status === 'COMPLETED') {
        nextPhaseData.completed_at = new Date();
      }

      if (Object.keys(nextPhaseData).length > 0) {
        await this.prisma.projectPhase.update({
          where: { id: step.phase_id },
          data: nextPhaseData,
        });
        phaseStatus = nextPhaseData.status;
      }
    }

    // Starting real implementation work moves the project out of planning.
    await this.prisma.complianceProject.updateMany({
      where: { id: projectId, status: 'PLANNING' },
      data: { status: 'IN_PROGRESS' },
    });

    const [finalPhase, finalProject] = await Promise.all([
      this.prisma.projectPhase.findUnique({
        where: { id: step.phase_id },
        select: { id: true, status: true, started_at: true, completed_at: true },
      }),
      this.prisma.complianceProject.findUnique({
        where: { id: projectId },
        select: { id: true, status: true },
      }),
    ]);

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
        phaseStatus,
      },
      ipAddress,
      userAgent,
    });

    return {
      step: updated,
      phase: finalPhase,
      project_status: finalProject?.status ?? null,
    };
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

  async updateStepMetadata(
    projectId: string,
    stepId: string,
    metadataJson: Record<string, unknown>,
    userId: string,
    userRole: ProjectRole,
  ) {
    if (
      userRole !== ProjectRole.PROJECT_LEAD &&
      userRole !== ProjectRole.PROJECT_AUDITOR
    ) {
      throw new ForbiddenException('Only leads and auditors can update step metadata');
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
      data: { metadata_json: metadataJson as Prisma.InputJsonValue },
    });
  }

  async assignTask(
    projectId: string,
    stepId: string | undefined,
    dto: { assigned_to: string; type: TaskType; notes?: string },
    userId: string,
    userRole: ProjectRole,
    ipAddress?: string,
    userAgent?: string,
  ) {
    if (
      userRole !== ProjectRole.PROJECT_LEAD &&
      userRole !== ProjectRole.PROJECT_AUDITOR
    ) {
      throw new ForbiddenException('Only leads and auditors can assign tasks');
    }

    // Verify the project exists
    const project = await this.prisma.complianceProject.findUnique({
      where: { id: projectId },
    });
    if (!project) {
      throw new NotFoundException('Project not found');
    }

    // Verify assignee is a project member
    const assigneeMembership = await this.prisma.projectMember.findUnique({
      where: { project_id_user_id: { project_id: projectId, user_id: dto.assigned_to } },
    });
    if (!assigneeMembership) {
      throw new ForbiddenException('Assignee must be a project member');
    }

    // If step provided, verify it belongs to this project and get document deadline
    let stepDeadline: Date | undefined;
    if (stepId) {
      const step = await this.prisma.projectStep.findUnique({
        where: { id: stepId },
        include: {
          phase: { select: { project_id: true } },
          document_instance: { select: { deadline: true } },
        },
      });
      if (!step || step.phase.project_id !== projectId) {
        throw new NotFoundException('Step not found');
      }
      stepDeadline = step.document_instance?.deadline ?? undefined;
    }

    return this.createTask(
      {
        projectId,
        organizationId: project.organization_id,
        stepId: stepId ?? null,
        assignedTo: dto.assigned_to,
        assignedBy: userId,
        type: dto.type,
        notes: dto.notes ?? null,
        deadline: stepDeadline ?? null,
      },
      ipAddress,
      userAgent,
    );
  }

  /** Creates a task, notifies the assignee and records it in the audit log. */
  private async createTask(
    t: {
      projectId: string;
      organizationId: string;
      stepId: string | null;
      assignedTo: string;
      assignedBy: string;
      type: TaskType;
      notes: string | null;
      deadline: Date | null;
    },
    ipAddress?: string,
    userAgent?: string,
  ) {
    const task = await this.prisma.taskAssignment.create({
      data: {
        project_id: t.projectId,
        step_id: t.stepId,
        assigned_to: t.assignedTo,
        assigned_by: t.assignedBy,
        type: t.type,
        notes: t.notes,
        deadline: t.deadline,
      },
      include: {
        assignee: { select: { id: true, email: true, first_name: true, last_name: true } },
        assigner: { select: { id: true, email: true, first_name: true, last_name: true } },
      },
    });

    await this.prisma.notification.create({
      data: {
        user_id: t.assignedTo,
        organization_id: t.organizationId,
        project_id: t.projectId,
        task_assignment_id: task.id,
        type: NotificationType.TASK_ASSIGNED,
      },
    });

    await this.auditLog.log({
      userId: t.assignedBy,
      action: AuditAction.TASK_ASSIGNED,
      entityType: 'task_assignment',
      entityId: task.id,
      details: { projectId: t.projectId, stepId: t.stepId, assignedTo: t.assignedTo, type: t.type },
      ipAddress,
      userAgent,
    });

    return task;
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
      await this.createTask(
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
      await this.createTask(
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

  /**
   * Methodology 3.4: risk owners review the risks at least once a year. When
   * the register is completed, the project lead gets a "Review of risks" task
   * due in one year; completing it schedules the next one (see completeTask).
   */
  private async scheduleRiskReview(projectId: string, stepId: string, completedBy: string) {
    const existing = await this.prisma.taskAssignment.findFirst({
      where: { step_id: stepId, type: TaskType.RISK_REVIEW, status: { not: 'COMPLETED' } },
    });
    if (existing) return;

    const [project, lead] = await Promise.all([
      this.prisma.complianceProject.findUnique({ where: { id: projectId }, select: { organization_id: true } }),
      this.prisma.projectMember.findFirst({
        where: { project_id: projectId, privilege: ProjectRole.PROJECT_LEAD },
        orderBy: { joined_at: 'asc' },
        select: { user_id: true },
      }),
    ]);
    if (!project) return;

    const due = new Date();
    due.setFullYear(due.getFullYear() + 1);
    await this.createTask({
      projectId,
      organizationId: project.organization_id,
      stepId,
      assignedTo: lead?.user_id ?? completedBy,
      assignedBy: completedBy,
      type: TaskType.RISK_REVIEW,
      notes:
        'Annual review of risks (Risk Assessment and Treatment Methodology, section 3.4): with the risk owners, ' +
        'review existing risks, add newly identified ones, update the risk register and refresh the Risk Assessment ' +
        'and Treatment Report. Review earlier after significant organizational, technology or business changes.',
      deadline: due,
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

  async getMyTasks(userId: string) {
    return this.prisma.taskAssignment.findMany({
      where: { assigned_to: userId },
      include: {
        project: { select: { id: true, name: true, organization_id: true } },
        step: { select: { id: true, title: true, key: true } },
        assigner: { select: { id: true, first_name: true, last_name: true } },
      },
      orderBy: { created_at: 'desc' },
    });
  }

  async getProjectTasks(projectId: string, userId: string) {
    // Verify membership
    const membership = await this.prisma.projectMember.findUnique({
      where: { project_id_user_id: { project_id: projectId, user_id: userId } },
    });
    if (!membership) {
      throw new ForbiddenException('You are not a member of this project');
    }

    return this.prisma.taskAssignment.findMany({
      where: { project_id: projectId },
      include: {
        assignee: { select: { id: true, email: true, first_name: true, last_name: true } },
        assigner: { select: { id: true, first_name: true, last_name: true } },
        step: { select: { id: true, title: true, key: true } },
      },
      orderBy: { created_at: 'desc' },
    });
  }

  async completeTask(
    taskId: string,
    userId: string,
    ipAddress?: string,
    userAgent?: string,
  ) {
    const task = await this.prisma.taskAssignment.findUnique({
      where: { id: taskId },
    });

    if (!task) {
      throw new NotFoundException('Task not found');
    }

    if (task.assigned_to !== userId) {
      throw new ForbiddenException('Only the assignee can complete this task');
    }

    if (task.status === 'COMPLETED') {
      throw new BadRequestException('Task is already completed');
    }

    const updated = await this.prisma.taskAssignment.update({
      where: { id: taskId },
      data: { status: 'COMPLETED', completed_at: new Date() },
      include: {
        assignee: { select: { id: true, email: true, first_name: true, last_name: true } },
        assigner: { select: { id: true, first_name: true, last_name: true } },
      },
    });

    // The yearly risk review repeats: completing one schedules the next.
    if (task.type === TaskType.RISK_REVIEW && task.step_id) {
      await this.scheduleRiskReview(task.project_id, task.step_id, userId);
    }

    // Notify the assigner that the task is complete
    await this.prisma.notification.create({
      data: {
        user_id: task.assigned_by,
        project_id: task.project_id,
        task_assignment_id: task.id,
        type: NotificationType.TASK_COMPLETED,
      },
    });

    await this.auditLog.log({
      userId,
      action: AuditAction.TASK_COMPLETED,
      entityType: 'task_assignment',
      entityId: taskId,
      details: { projectId: task.project_id, type: task.type, assignedTo: task.assigned_to },
      ipAddress,
      userAgent,
    });

    return updated;
  }
}
