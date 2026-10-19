import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { ProjectRole, TaskStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { AiServiceClient } from '../ai/ai-service.client';
import { NextActionsService } from '../ai/next-actions.service';
import { TASK_TYPE_LABELS } from '../tasks/task-labels';

const DAY = 24 * 60 * 60 * 1000;
const WEEK = 7 * DAY;
const OPEN = [TaskStatus.PENDING, TaskStatus.IN_PROGRESS];

/** Used when the AI is not available: one practical tip per phase. */
const PHASE_TIPS = [
  'Agree early on who decides what: a project lead and top management who approve on time keep everything else moving.',
  'Choose risk owners who can really decide on the treatment, and keep the likelihood and impact scale the same for every risk.',
  'Write policies the way your team actually works: a short procedure people follow beats a long one nobody reads.',
  'Collect evidence as you go (training records, meeting minutes, logs) rather than all at once before the audit.',
  'Put the next management review and internal audit in the calendar now, so the ISMS keeps running between audits.',
];
const ENCOURAGEMENT = 'Every step you complete brings the certification a little closer. Have a good week!';

const ROLE = (privilege: ProjectRole) =>
  privilege === ProjectRole.PROJECT_LEAD ? 'project lead' : privilege === ProjectRole.PROJECT_AUDITOR ? 'auditor' : 'implementer';
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;
const shortDay = (d: Date) => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

interface ProjectWeek {
  id: string;
  name: string;
  link: string;
  role: string;
  phase: string;
  phaseOrder: number;
  progress: number;
  stats: { teamTasks: number; teamSteps: number; yourDone: number; yourOpen: number; yourOverdue: number };
  /** Plain sentences given to the AI, and the source of the fallback text. */
  facts: string;
}

interface AiDigest {
  headline: string;
  projects: { id: string; team: string; you: string }[];
  next_steps: { id: string; why: string }[];
  tip: string;
  encouragement: string;
}

/**
 * The Monday e-mail: for each person, one message over all their projects
 * with the team's week, their own week, next steps, a tip and a word of
 * encouragement. The facts are computed here; the AI service only writes the
 * sentences (every number it uses must come from the facts). Without the AI
 * the same e-mail is sent with plain sentences.
 */
@Injectable()
export class DigestService {
  private readonly logger = new Logger(DigestService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly nextActions: NextActionsService,
    private readonly ai: AiServiceClient,
    private readonly mail: MailService,
    private readonly config: ConfigService,
  ) {}

  @Cron('0 8 * * 1', { name: 'weekly-digest' })
  async sendAll() {
    const users = await this.prisma.user.findMany({
      where: { weekly_digest: true, is_active: true, is_email_verified: true, project_memberships: { some: {} } },
      select: { id: true },
    });
    let sent = 0;
    for (const u of users) {
      // One at a time: a mail or AI problem for one person must not stop the others.
      if (await this.send(u.id).catch((e: Error) => this.logger.warn(`Digest not sent to ${u.id}: ${e.message}`))) sent++;
    }
    this.logger.log(`Weekly digest sent to ${sent} of ${users.length} people`);
  }

  /** Builds and sends one person's digest; false when there was nothing to tell. */
  async send(userId: string): Promise<boolean> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { email: true, first_name: true, project_memberships: { select: { project_id: true } } },
    });
    const now = new Date();
    const weeks = (await Promise.all(user.project_memberships.map(m => this.projectWeek(m.project_id, userId, now)))).filter(w => w !== null);
    const pending = (await Promise.all(weeks.map(w => this.nextActions.pending(w.id, userId).then(items => items.map(i => ({ ...i, project: w.name })))))).flat().slice(0, 20);
    if (weeks.length === 0 || (pending.length === 0 && weeks.every(w => !w.stats.teamTasks && !w.stats.teamSteps && !w.stats.yourOpen))) return false;

    let text: AiDigest | null = null;
    try {
      text = await this.ai.request<AiDigest>('POST', '/v1/weekly-digest', {
        user_id: userId,
        user: user.first_name,
        projects: weeks.map(w => ({ id: w.id, facts: w.facts })),
        items: pending.map(i => ({ id: i.id, text: `${i.project}: ${i.title}` })),
      }, { timeoutMs: 60_000 });
    } catch (e) {
      this.logger.warn(`Digest without AI for ${userId}: ${(e as Error).message}`);
    }

    const frontend = this.config.get('FRONTEND_URL', 'http://localhost:3000');
    const byId = new Map(pending.map(i => [i.id, i]));
    const nextSteps = text
      ? text.next_steps.filter(s => byId.has(s.id)).map(s => ({ ...byId.get(s.id)!, why: s.why }))
      : pending.slice(0, 4).map(i => ({ ...i, why: '' }));
    const headline = text?.headline ?? 'Your week on APTISO';

    await this.mail.sendWeeklyDigest(user.email, `Your week on APTISO: ${headline}`, {
      firstName: user.first_name,
      week: `${shortDay(new Date(now.getTime() - WEEK + DAY))} – ${shortDay(now)}`,
      headline,
      projects: weeks.map(w => {
        const t = text?.projects.find(p => p.id === w.id);
        return { ...w, link: `${frontend}${w.link}`, team: t?.team ?? this.teamSentence(w), you: t?.you ?? this.youSentence(w) };
      }),
      nextSteps: nextSteps.map(s => ({ title: s.title, project: s.project, why: s.why, link: `${frontend}${s.href}` })),
      tip: text?.tip ?? PHASE_TIPS[Math.min(weeks[0].phaseOrder, 5) - 1],
      encouragement: text?.encouragement ?? ENCOURAGEMENT,
      settingsLink: `${frontend}/dashboard/profile`,
      byAi: !!text,
    });
    return true;
  }

  /** The facts of one project for one member over the last 7 days. */
  private async projectWeek(projectId: string, userId: string, now: Date): Promise<ProjectWeek | null> {
    const since = new Date(now.getTime() - WEEK);
    const project = await this.prisma.complianceProject.findUnique({
      where: { id: projectId },
      select: {
        name: true,
        organization_id: true,
        members: { where: { user_id: userId }, select: { privilege: true, iso_roles: { select: { iso_role: true } } } },
        phases: { orderBy: { order: 'asc' }, select: { name: true, order: true, steps: { orderBy: { order: 'asc' }, select: { title: true, status: true, completed_at: true } } } },
      },
    });
    const member = project?.members[0];
    if (!project || !member) return null;

    const [teamDone, mine] = await Promise.all([
      this.prisma.taskAssignment.findMany({
        where: { project_id: projectId, status: TaskStatus.COMPLETED, completed_at: { gte: since } },
        select: { type: true, assigned_to: true, assignee: { select: { first_name: true } }, step: { select: { title: true } }, document: { select: { title: true } } },
        take: 30,
      }),
      this.prisma.taskAssignment.findMany({ where: { project_id: projectId, assigned_to: userId, status: { in: OPEN } }, select: { deadline: true } }),
    ]);
    const steps = project.phases.flatMap(p => p.steps.map(s => ({ ...s, phase: p })));
    const stepsDone = steps.filter(s => s.completed_at && s.completed_at >= since);
    const current = steps.find(s => s.status !== 'COMPLETED');
    const progress = steps.length ? Math.round((steps.filter(s => s.status === 'COMPLETED').length / steps.length) * 100) : 0;
    const yourDone = teamDone.filter(t => t.assigned_to === userId);
    const overdue = mine.filter(t => t.deadline && t.deadline < now).length;
    const dueSoon = mine.filter(t => t.deadline && t.deadline >= now && t.deadline.getTime() - now.getTime() < WEEK).length;
    const task = (t: (typeof teamDone)[number]) => `${TASK_TYPE_LABELS[t.type]}${t.document?.title ?? t.step?.title ? ` – ${t.document?.title ?? t.step?.title}` : ''}`;

    const isoRoles = member.iso_roles.map(r => r.iso_role.toLowerCase().replace(/_/g, ' '));
    const phase = current ? current.phase.name : 'All steps completed';
    const facts = [
      `Project "${project.name}". Your role: ${ROLE(member.privilege)}${isoRoles.length ? ` (ISO roles: ${isoRoles.join(', ')})` : ''}.`,
      `Current phase: ${phase}${current ? `, next step "${current.title}"` : ''}. Overall progress ${progress}%.`,
      `Team this week: ${plural(teamDone.length, 'task')} completed${teamDone.length ? ` (${teamDone.slice(0, 8).map(t => `${t.assignee.first_name}: ${task(t)}`).join('; ')})` : ''}; ${plural(stepsDone.length, 'step')} completed${stepsDone.length ? ` (${stepsDone.map(s => `"${s.title}"`).join(', ')})` : ''}.`,
      `You this week: ${plural(yourDone.length, 'task')} completed${yourDone.length ? ` (${yourDone.map(task).join('; ')})` : ''}. Open: ${plural(mine.length, 'task')}, ${overdue} overdue, ${dueSoon} due in the next 7 days.`,
    ].join('\n');

    return {
      id: projectId,
      name: project.name,
      link: `/dashboard/organizations/${project.organization_id}/projects/${projectId}`,
      role: ROLE(member.privilege),
      phase,
      phaseOrder: current?.phase.order ?? 5,
      progress,
      stats: { teamTasks: teamDone.length, teamSteps: stepsDone.length, yourDone: yourDone.length, yourOpen: mine.length, yourOverdue: overdue },
      facts,
    };
  }

  private teamSentence(w: ProjectWeek) {
    const { teamTasks, teamSteps } = w.stats;
    const week = teamTasks || teamSteps ? `The team completed ${plural(teamTasks, 'task')} and ${plural(teamSteps, 'step')} this week.` : 'A quiet week for the team.';
    return `${week} Current phase: ${w.phase} (${w.progress}% of the project done).`;
  }

  private youSentence(w: ProjectWeek) {
    const { yourDone, yourOpen, yourOverdue } = w.stats;
    return `You completed ${plural(yourDone, 'task')}. ${plural(yourOpen, 'task')} open${yourOverdue ? `, ${yourOverdue} overdue` : ''}.`;
  }
}
