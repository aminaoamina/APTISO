import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectAccessService } from '../common/services/project-access.service';
import { ISMS_SCOPE_TEMPLATE_CODE } from '../documents/templates/isms-scope.template';
import { AiServiceClient } from './ai-service.client';
import { DecisionDto, ImproveDto, SuggestDto } from './assist.dto';
import { budget, proseText } from './text';

/** Prefilled from the project; never suggested. */
const NOT_SUGGESTED = new Set(['company_name', 'document_code']);
const TEXT_TYPES = new Set(['TEXT', 'LONGTEXT']);

interface Item { id: string; label: string; text: string }
interface Suggestion { answer: string; support: { data_id: string; quote: string }[]; missing: string[]; run_id: string }

const ISO_ROLE_LABELS: Record<string, string> = {
  TOP_MANAGEMENT: 'top management', INFORMATION_SECURITY_MANAGER: 'information security manager', ASSET_OWNER: 'asset owner',
  DEPARTMENT_HEAD: 'department head', IT_ADMINISTRATOR: 'IT administrator', INTERNAL_AUDITOR: 'internal auditor', EMPLOYEE: 'employee',
};

/**
 * Wizard ✨ Suggest and Improve paragraph. This side decides who may ask and
 * what the AI may know; the AI service (apps/ai) writes and validates the answer.
 */
@Injectable()
export class AssistService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: ProjectAccessService,
    private readonly ai: AiServiceClient,
  ) {}

  async suggest(projectId: string, userId: string, dto: SuggestDto) {
    this.access.assertEdit(await this.access.forProject(projectId, userId));
    const question = await this.prisma.templateQuestion.findFirst({
      where: { key: dto.questionKey, template: { code: dto.templateCode } },
      include: { template: { select: { name: true, questions: { select: { key: true, label: true, input_type: true } } } } },
    });
    if (!question) throw new NotFoundException('Question not found');
    if (!TEXT_TYPES.has(question.input_type) || NOT_SUGGESTED.has(question.key)) {
      throw new BadRequestException('Suggestions are available for text questions only');
    }

    const items = await this.contextItems(projectId, dto.templateCode);
    // What the person has typed so far in this wizard (their own input: sent as data, like the rest).
    for (const q of question.template.questions) {
      const value = dto.answers?.[q.key]?.trim();
      if (value && q.key !== question.key && q.input_type !== 'PERSON' && q.input_type !== 'DATE') {
        items.push({ id: `current:${q.key}`, label: `This document: ${q.label}`, text: value.slice(0, 2000) });
      }
    }

    const { status, data } = await this.ai.call<Suggestion & { code?: string }>('POST', '/v1/wizard/suggest', {
      project_id: projectId,
      user_id: userId,
      document: question.template.name,
      question: { key: question.key, label: question.label, help_text: question.help_text, long: question.input_type === 'LONGTEXT' },
      items,
    }, { timeoutMs: 60_000 });
    if (status === 422 && data?.code === 'ai_rejected') {
      return { answer: '', missing: ['The project data does not say this yet: write it yourself, or add it to the organization profile.'], sources: [], run_id: null };
    }
    if (status >= 400) throw this.ai.error(status, 'POST /v1/wizard/suggest');
    // Each part of the answer with the words it comes from (checked word for word by the AI service).
    const labels = new Map(items.map(i => [i.id, i.label]));
    return {
      answer: data.answer,
      missing: data.missing,
      sources: data.support.map(s => ({ label: labels.get(s.data_id) ?? s.data_id, quote: s.quote })),
      run_id: data.run_id,
    };
  }

  /** The text stream of the rewritten passage; the caller forwards it to the browser. */
  async improve(projectId: string, userId: string, dto: ImproveDto, signal: AbortSignal) {
    this.access.assertEdit(await this.access.forProject(projectId, userId));
    const doc = await this.prisma.documentInstance.findFirst({
      where: { id: dto.documentId, step: { phase: { project_id: projectId } } },
      select: { status: true },
    });
    if (!doc) throw new NotFoundException('Document not found');
    if (doc.status === 'IN_REVIEW') throw new ConflictException('This document is waiting for approval: withdraw it first to change it');
    return this.ai.stream('/v1/improve', { project_id: projectId, user_id: userId, document_id: dto.documentId, text: dto.text, instruction: dto.instruction }, signal);
  }

  /** The person's decision on a proposal: recorded here (authoritative), with a copy in the AI service. */
  async decide(projectId: string, userId: string, dto: DecisionDto) {
    await this.access.forProject(projectId, userId);
    const { status, data } = await this.ai.call<{ capability: string; subject_type: string | null; subject_id: string | null }>(
      'POST', `/v1/runs/${dto.runId}/outcome`, { project_id: projectId, user_id: userId, outcome: dto.outcome.toLowerCase() },
    );
    // Only the person the proposal was made for, in this project, can decide on it.
    if (status === 404) throw new NotFoundException('AI proposal not found');
    if (status >= 400) throw new BadRequestException('The decision could not be recorded');
    try {
      await this.prisma.aiDecision.create({
        data: { run_id: dto.runId, project_id: projectId, user_id: userId, capability: data.capability, subject_type: data.subject_type, subject_id: data.subject_id, outcome: dto.outcome },
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') throw new ConflictException('This proposal was already decided');
      throw e;
    }
    return { outcome: dto.outcome };
  }

  /** Facts the project already holds, each with an id the AI must cite. */
  private async contextItems(projectId: string, templateCode: string): Promise<Item[]> {
    const [project, members, requirements, documents] = await Promise.all([
      this.prisma.complianceProject.findUnique({ where: { id: projectId }, select: { organization: { select: { name: true, industry: true, description: true } } } }),
      this.prisma.projectMember.findMany({
        where: { project_id: projectId },
        select: { privilege: true, custom_role: true, user: { select: { first_name: true, last_name: true } }, iso_roles: { select: { iso_role: true } } },
      }),
      this.prisma.requirement.findMany({
        where: { step: { phase: { project_id: projectId } } },
        select: { requirement_type: true, interested_party: true, description: true, related_area: true },
        take: 30,
      }),
      this.prisma.documentInstance.findMany({
        where: { step: { phase: { project_id: projectId } }, NOT: { answers: { equals: Prisma.DbNull } } },
        select: { answers: true, content: true, template: { select: { code: true, name: true, questions: { select: { key: true, label: true, input_type: true } } } } },
      }),
    ]);

    const items: Item[] = [];
    const org = project?.organization;
    if (org) {
      items.push({ id: 'org', label: 'Organization profile', text: [`Name: ${org.name}`, org.industry && `Industry: ${org.industry}`, org.description && `Description: ${org.description}`].filter(Boolean).join('\n') });
    }
    if (members.length) {
      items.push({
        id: 'team', label: 'Project team',
        text: members.map(m => {
          const roles = [m.custom_role, ...m.iso_roles.map(r => ISO_ROLE_LABELS[r.iso_role] ?? r.iso_role)].filter(Boolean).join(', ');
          return `- ${m.user.first_name} ${m.user.last_name}${roles ? `: ${roles}` : ''}`;
        }).join('\n'),
      });
    }
    if (requirements.length) {
      items.push({
        id: 'requirements', label: 'Requirements of interested parties',
        text: requirements.map(r => `- ${r.interested_party} (${r.requirement_type.toLowerCase()}): ${r.description}${r.related_area ? ` [${r.related_area}]` : ''}`).join('\n').slice(0, 4000),
      });
    }
    for (const d of documents) {
      if (d.template.code === templateCode) continue; // this wizard's own answers come from the browser
      const answers = (d.answers ?? {}) as Record<string, unknown>;
      for (const q of d.template.questions) {
        const value = answers[q.key];
        if (TEXT_TYPES.has(q.input_type) && typeof value === 'string' && value.trim() && !NOT_SUGGESTED.has(q.key)) {
          items.push({ id: `doc:${d.template.code}.${q.key}`, label: `${d.template.name}: ${q.label}`, text: value.trim().slice(0, 2000) });
        }
      }
      if (d.template.code === ISMS_SCOPE_TEMPLATE_CODE) {
        items.push({ id: 'scope', label: 'ISMS scope document', text: budget(proseText(d.content), 3000) });
      }
    }
    return items.slice(0, 80);
  }
}
