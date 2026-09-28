import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { AuditAction, Prisma, ProjectRole, StepType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../common/services/audit-log.service';
import {
  ProseMirrorNode,
  bulletList,
  heading,
  italic,
  paragraph,
  placeholder,
  table,
  text,
} from '../documents/templates/doc-control.template';
import { STATUS_LABELS, compareControlCodes } from '../soa/soa.service';
import {
  POLICY_CATALOG,
  PolicyDefinition,
  assertPolicyCatalog,
  findPolicyByStepKey,
  policyStepKey,
} from './policy-catalog';

const SOA_STEP_KEY = 'iso27001.p2s3.statement-of-applicability';
const SECURITY_DOCUMENTATION_PHASE_ORDER = 3;
export const WHY_FROM_SOA = 'This document is mandatory, as you specified in the Statement of Applicability';

const USER_SELECT = { id: true, first_name: true, last_name: true } as const;

@Injectable()
export class PoliciesService implements OnModuleInit {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  onModuleInit() {
    assertPolicyCatalog();
  }

  // ─── Phase 3 generation from the SoA ───────────────────────────

  /**
   * Adds a Phase 3 step for every policy that covers at least one applicable
   * control. Policies that are no longer needed are kept (work is never lost)
   * but flagged "no longer required". Called when the SoA step is completed.
   */
  async syncFromSoa(soaStepId: string, userId: string) {
    const soaStep = await this.prisma.projectStep.findUnique({
      where: { id: soaStepId },
      select: { key: true, phase: { select: { project_id: true } } },
    });
    if (!soaStep || soaStep.key !== SOA_STEP_KEY) throw new NotFoundException('Statement of Applicability step not found');
    const projectId = soaStep.phase.project_id;

    const phase = await this.prisma.projectPhase.findFirst({
      where: { project_id: projectId, order: SECURITY_DOCUMENTATION_PHASE_ORDER },
      include: { steps: { select: { id: true, key: true, metadata_json: true } } },
    });
    if (!phase) throw new NotFoundException('Security Documentation phase not found');

    const [rows, register] = await Promise.all([
      this.prisma.soaControl.findMany({
        where: { step_id: soaStepId, applicable: true },
        select: { control: { select: { code: true } } },
      }),
      this.prisma.soaRegister.findUnique({ where: { step_id: soaStepId }, select: { setup: true } }),
    ]);
    const applicable = new Set(rows.map(r => r.control.code));
    const setup = (register?.setup ?? {}) as Record<string, boolean>;

    const result = { added: [] as string[], noLongerRequired: [] as string[], unchanged: 0 };
    for (const [index, policy] of POLICY_CATALOG.entries()) {
      const covered = policy.controls.filter(c => applicable.has(c)).sort(compareControlCodes);
      const required = covered.length > 0 && (!policy.requiresSetup || setup[policy.requiresSetup] === true);
      const key = policyStepKey(policy.key);
      const existing = phase.steps.find(s => s.key === key);
      const metadata = this.stepMetadata(policy, covered, required);

      if (!existing) {
        if (!required) continue;
        await this.prisma.projectStep.create({
          data: {
            phase_id: phase.id,
            key,
            title: policy.title,
            purpose: policy.purpose,
            type: StepType.DOCUMENT,
            order: index + 1,
            metadata_json: metadata,
          },
        });
        result.added.push(policy.title);
        continue;
      }
      const previous = (existing.metadata_json ?? {}) as Record<string, unknown>;
      if (previous.required !== false && !required) result.noLongerRequired.push(policy.title);
      else result.unchanged++;
      // Keep user-edited metadata such as a deadline; refresh what the SoA decides.
      await this.prisma.projectStep.update({
        where: { id: existing.id },
        data: { metadata_json: { ...previous, ...metadata, controls: required ? covered : previous.controls ?? [] } as Prisma.InputJsonValue },
      });
    }

    await this.auditLog.log({
      userId,
      action: AuditAction.DOCUMENT_UPDATED,
      entityType: 'project_phase',
      entityId: phase.id,
      details: { action: 'sync_policies_from_soa', ...result } as never,
    });
    return result;
  }

  private stepMetadata(policy: PolicyDefinition, covered: string[], required: boolean) {
    return {
      clause: covered.length > 0 ? `Controls ${covered.join(', ')}` : 'No applicable control',
      controls: covered,
      policy_key: policy.key,
      generated_from_soa: true,
      required,
      why: required ? WHY_FROM_SOA : 'No longer required: none of the controls it covers is applicable in the Statement of Applicability',
      // Conformio: 1 hour to write + 1 hour to review and approve; usually 2 days.
      workload_hours: 2,
      estimated_days: 2,
      mandatory: required,
    };
  }

  // ─── Policy step ───────────────────────────────────────────────

  async getPolicy(stepId: string, userId: string) {
    const { step, policy } = await this.ensurePolicyStep(stepId, userId);
    const controls = await this.getControlDetails(step.phase.project_id, policy);
    const meta = (step.metadata_json ?? {}) as Record<string, unknown>;
    return {
      policy: { key: policy.key, title: policy.title, purpose: policy.purpose },
      required: meta.required !== false,
      why: meta.why ?? WHY_FROM_SOA,
      controls,
    };
  }

  /** Creates the first draft of the policy from the SoA (no question wizard). */
  async createDraft(stepId: string, userId: string, ipAddress?: string, userAgent?: string) {
    const { step, policy, role } = await this.ensurePolicyStep(stepId, userId);
    if (role === ProjectRole.PROJECT_AUDITOR) throw new ForbiddenException('Auditors cannot create documents');
    const existing = await this.prisma.documentInstance.findUnique({ where: { step_id: stepId } });
    if (existing) throw new ConflictException('This step already has a document; delete it first to regenerate the draft');

    const projectId = step.phase.project_id;
    const [controls, project] = await Promise.all([
      this.getControlDetails(projectId, policy),
      this.prisma.complianceProject.findUnique({
        where: { id: projectId },
        select: { organization: { select: { name: true } } },
      }),
    ]);
    const covered = controls.filter(c => c.applicable);
    if (covered.length === 0) throw new BadRequestException('None of the controls of this policy is applicable in the Statement of Applicability');
    const orgName = project?.organization?.name ?? 'Organization';

    const template = await this.prisma.documentTemplate.upsert({
      where: { code: this.templateCode(policy) },
      update: {},
      create: {
        code: this.templateCode(policy),
        name: policy.title,
        description: `${policy.purpose} Draft generated from the Statement of Applicability.`,
      },
    });

    // The inputs are stored with the document so the AI engine can later
    // rewrite the draft into a complete policy.
    const inputs = {
      generated_from: 'statement_of_applicability',
      policy_key: policy.key,
      organization: orgName,
      controls: covered.map(c => ({ code: c.code, title: c.title, method: c.method, status: c.status })),
    };

    const doc = await this.prisma.documentInstance.create({
      data: {
        template_id: template.id,
        step_id: stepId,
        title: policy.title,
        status: 'DRAFT',
        version: '0.1',
        content: this.buildDraft(policy, covered, orgName) as never,
        answers: inputs as Prisma.InputJsonValue,
        created_by: userId,
        last_edited_by: userId,
      },
    });
    await this.auditLog.log({
      userId,
      action: AuditAction.DOCUMENT_CREATED,
      entityType: 'document_instance',
      entityId: doc.id,
      details: { action: 'policy_draft_from_soa', policy: policy.key, controls: covered.length },
      ipAddress,
      userAgent,
    });
    return doc;
  }

  private buildDraft(
    policy: PolicyDefinition,
    controls: Awaited<ReturnType<PoliciesService['getControlDetails']>>,
    orgName: string,
  ): ProseMirrorNode {
    const date = new Date();
    const ds = `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`;
    const content: ProseMirrorNode[] = [
      heading(1, policy.title),
      table([
        [[text('Organization')], [text(orgName)]],
        [[text('Document code')], [placeholder('document code')]],
        [[text('Version')], [text('0.1')]],
        [[text('Date of version')], [text(ds)]],
        [[text('Created by')], [placeholder('author')]],
        [[text('Approved by')], [placeholder('approver')]],
        [[text('Confidentiality level')], [text('Internal')]],
      ]),
      paragraph(italic(text(
        'Draft generated from the Statement of Applicability. Review and complete every section — in particular the text in brackets — before submitting it for approval.',
      ))),

      heading(2, '1. Purpose, scope and users'),
      paragraph(text(`The purpose of this document is to ${policy.purpose.charAt(0).toLowerCase()}${policy.purpose.slice(1)}`)),
      paragraph(text(`This document applies to the entire scope of the Information Security Management System (ISMS) of ${orgName}.`)),
      paragraph(text('Users of this document are all employees and, where relevant, external parties working for the organization.')),

      heading(2, '2. Reference documents'),
      bulletList([
        [text(`ISO/IEC 27001 standard, Annex A controls ${controls.map(c => c.code).join(', ')}`)],
        [text('Information Security Policy')],
        [text('Statement of Applicability')],
        [text('Risk Assessment and Risk Treatment Methodology')],
      ]),

      heading(2, '3. Rules'),
    ];

    controls.forEach((c, i) => {
      content.push(heading(3, `3.${i + 1}. ${c.title} (${c.code})`));
      content.push(paragraph(text(c.method?.trim() || 'Describe how this control is implemented.')));
      if (c.status && c.status !== 'IMPLEMENTED') {
        const who = c.responsible ? `${c.responsible.first_name} ${c.responsible.last_name}` : 'the responsible person';
        const when = c.deadline ? ` by ${c.deadline.toISOString().slice(0, 10)}` : '';
        content.push(paragraph(italic(text(
          `Status: ${STATUS_LABELS[c.status]} — to be implemented by ${who}${when}, as defined in the Risk Treatment Plan.`,
        ))));
      }
    });

    content.push(
      heading(2, '4. Responsibilities'),
      paragraph(placeholder('job title of the person responsible for this policy'), text(' is responsible for implementing this document, communicating it to the users, and monitoring compliance.')),
      paragraph(text('All users are responsible for complying with the rules in this document. Violations are handled through the disciplinary process.')),

      heading(2, '5. Validity and document management'),
      paragraph(text('This document is valid as of '), placeholder('effective date'), text('.')),
      paragraph(text('The owner of this document is '), placeholder('document owner'), text(', who must check and, if necessary, update the document at least once a year, and after significant changes in the organization, technology or risks.')),
      paragraph(text('When evaluating the effectiveness and adequacy of this document, the following criteria need to be considered: the number of incidents related to the rules in this document, and the number of nonconformities found in internal and external audits.')),
    );

    return { type: 'doc', content };
  }

  // ─── Helpers ───────────────────────────────────────────────────

  private templateCode(policy: PolicyDefinition) {
    return `P3-${policy.key.toUpperCase()}`.slice(0, 50);
  }

  /** The policy's controls with their SoA decisions (method, status, plan). */
  private async getControlDetails(projectId: string, policy: PolicyDefinition) {
    const soaStep = await this.prisma.projectStep.findFirst({
      where: { key: SOA_STEP_KEY, phase: { project_id: projectId } },
      select: { id: true },
    });
    const rows = soaStep
      ? await this.prisma.soaControl.findMany({
          where: { step_id: soaStep.id, control: { code: { in: policy.controls } } },
          include: { control: { select: { code: true, title: true } }, responsible: { select: USER_SELECT } },
        })
      : [];
    const controls = await this.prisma.riskControl.findMany({
      where: { code: { in: policy.controls } },
      select: { code: true, title: true },
    });
    return controls
      .map(c => {
        const row = rows.find(r => r.control.code === c.code);
        return {
          code: c.code,
          title: c.title,
          applicable: row?.applicable === true,
          method: row?.implementation_method ?? null,
          status: row?.status ?? null,
          responsible: row?.responsible ?? null,
          deadline: row?.deadline ?? null,
        };
      })
      .sort((a, b) => compareControlCodes(a.code, b.code));
  }

  private async ensurePolicyStep(stepId: string, userId: string) {
    const step = await this.prisma.projectStep.findUnique({
      where: { id: stepId },
      include: {
        phase: {
          select: {
            project_id: true,
            project: { select: { members: { where: { user_id: userId }, select: { privilege: true } } } },
          },
        },
      },
    });
    if (!step) throw new NotFoundException('Step not found');
    const membership = step.phase.project.members[0];
    if (!membership) throw new ForbiddenException('You are not a member of this project');
    const policy = findPolicyByStepKey(step.key);
    if (!policy) throw new NotFoundException('This step is not a Phase 3 policy step');
    return { step, policy, role: membership.privilege };
  }
}
