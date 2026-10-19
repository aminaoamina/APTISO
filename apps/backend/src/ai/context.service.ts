import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectAccessService } from '../common/services/project-access.service';
import { RISK_REGISTER_KEY, SOA_KEY } from '../audit-prep/keys';
import { ISMS_SCOPE_TEMPLATE_CODE } from '../documents/templates/isms-scope.template';
import { budget, proseText } from './text';

const ROLE_LABELS = { PROJECT_LEAD: 'project lead', PROJECT_MEMBER: 'implementer (project member)', PROJECT_AUDITOR: 'auditor (read-only)' } as const;

export interface ContextOptions {
  /** Clauses / controls the request is about: selects the SoA rows and risks. */
  refs?: string[];
  /** Character budgets per section (≈ 4 characters per token). */
  scopeChars?: number;
  maxRisks?: number;
}

/**
 * What the AI may know about the person asking and their project. Access comes
 * from the authenticated user (ProjectAccessService), never from the request.
 */
@Injectable()
export class AiContextService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: ProjectAccessService,
  ) {}

  async build(projectId: string, userId: string, opts: ContextOptions = {}) {
    const access = await this.access.forProject(projectId, userId);
    const refs = opts.refs ?? [];
    const [project, user, tasks, scopeDoc, soaStep, riskStep] = await Promise.all([
      this.prisma.complianceProject.findUnique({ where: { id: projectId }, select: { name: true, organization: { select: { name: true } } } }),
      this.prisma.user.findUnique({ where: { id: userId }, select: { first_name: true, last_name: true } }),
      this.prisma.taskAssignment.findMany({
        where: { project_id: projectId, assigned_to: userId, status: { notIn: ['COMPLETED', 'CANCELLED'] } },
        select: { id: true, type: true, notes: true, deadline: true },
        orderBy: { deadline: 'asc' },
        take: 10,
      }),
      this.prisma.documentInstance.findFirst({
        where: { template: { code: ISMS_SCOPE_TEMPLATE_CODE }, step: { phase: { project_id: projectId } } },
        select: { content: true },
      }),
      this.access.stepByKey(projectId, SOA_KEY),
      this.access.stepByKey(projectId, RISK_REGISTER_KEY),
    ]);

    const soa = soaStep && refs.length
      ? await this.prisma.soaControl.findMany({
          where: { step_id: soaStep.id, control: { code: { in: refs } } },
          select: { applicable: true, justification: true, implementation_method: true, status: true, control: { select: { code: true, title: true } } },
        })
      : [];
    // Same numbering as the Risk Register and its report (R-001 ...).
    const risks = riskStep
      ? (await this.prisma.riskItem.findMany({
          where: { step_id: riskStep.id, discarding: false },
          orderBy: { created_at: 'asc' },
          select: {
            level: true, acceptability: true, treatment_option: true,
            asset: { select: { name: true } }, threat: { select: { name: true } }, vulnerability: { select: { name: true } },
            treatment_controls_link: { select: { control: { select: { code: true } } } },
          },
        }))
          .map((r, i) => ({ ref: `R-${String(i + 1).padStart(3, '0')}`, ...r, controls: r.treatment_controls_link.map(l => l.control.code) }))
          .filter(r => refs.length === 0 || r.controls.some(c => refs.includes(c)))
          .slice(0, opts.maxRisks ?? 10)
      : [];

    return {
      access,
      organization: project?.organization?.name ?? 'the organization',
      project: project?.name ?? '',
      user: { name: user ? `${user.first_name} ${user.last_name}`.trim() : '', role: ROLE_LABELS[access.role], isTopManagement: access.isTopManagement },
      tasks,
      scope: scopeDoc ? budget(proseText(scopeDoc.content), opts.scopeChars ?? 3000) : null,
      soa,
      risks,
    };
  }

  /** The context as tagged data for a prompt (untrusted: written by users). */
  toPrompt(c: Awaited<ReturnType<AiContextService['build']>>) {
    const lines = [
      `<data name="organization">${c.organization} — project "${c.project}"</data>`,
      `<data name="user">${c.user.name}, ${c.user.role}${c.user.isTopManagement ? ', top management' : ''}</data>`,
      c.scope ? `<data name="isms_scope">\n${c.scope}\n</data>` : '<data name="isms_scope">The ISMS scope document is not written yet.</data>',
    ];
    if (c.soa.length) {
      lines.push(`<data name="statement_of_applicability">\n${c.soa.map(s =>
        `${s.control.code} ${s.control.title}: ${s.applicable == null ? 'not decided' : s.applicable ? 'applicable' : 'not applicable'}`
        + `${s.justification ? `; justification: ${s.justification}` : ''}${s.implementation_method ? `; method: ${s.implementation_method}` : ''}${s.status ? `; status: ${s.status}` : ''}`).join('\n')}\n</data>`);
    }
    if (c.risks.length) {
      lines.push(`<data name="risks">\n${c.risks.map(r =>
        `${r.ref} ${r.asset.name} / ${r.threat.name} / ${r.vulnerability.name}: level ${r.level ?? '?'}, ${r.acceptability ?? 'not assessed'}${r.treatment_option ? `, treatment ${r.treatment_option}` : ''}${r.controls.length ? `, controls ${r.controls.join(', ')}` : ''}`).join('\n')}\n</data>`);
    }
    return lines.join('\n');
  }
}
