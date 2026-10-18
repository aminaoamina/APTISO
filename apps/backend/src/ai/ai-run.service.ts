import { Injectable } from '@nestjs/common';
import { AiRunStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface RunSubject {
  capability: string;
  promptVersion: string;
  inputHash: string;
  projectId?: string | null;
  userId?: string | null;
  subjectType?: string;
  subjectId?: string;
}

export interface RunResult {
  status: AiRunStatus;
  model?: string | null;
  output?: unknown;
  validation?: unknown;
  tokensIn?: number;
  tokensOut?: number;
  latencyMs?: number;
  error?: string | null;
}

const json = (v: unknown) => (v === undefined ? undefined : (v as Prisma.InputJsonValue));

/** The audit trail of AI operations (ai_runs): what was asked, which model and prompt answered, and the validation result. */
@Injectable()
export class AiRunService {
  constructor(private readonly prisma: PrismaService) {}

  /** A run that will be completed later (background jobs). */
  start(s: RunSubject, status: AiRunStatus = AiRunStatus.PENDING) {
    return this.prisma.aiRun.create({ data: { ...this.subject(s), status } });
  }

  finish(id: string, r: RunResult) {
    return this.prisma.aiRun.update({ where: { id }, data: this.result(r) });
  }

  /** A run recorded once it is over (synchronous calls). */
  record(s: RunSubject, r: RunResult) {
    return this.prisma.aiRun.create({ data: { ...this.subject(s), ...this.result(r) } });
  }

  private subject(s: RunSubject) {
    return {
      capability: s.capability,
      prompt_version: s.promptVersion,
      input_hash: s.inputHash,
      project_id: s.projectId ?? null,
      user_id: s.userId ?? null,
      subject_type: s.subjectType ?? null,
      subject_id: s.subjectId ?? null,
    };
  }

  private result(r: RunResult) {
    return {
      status: r.status,
      model: r.model ?? null,
      output: json(r.output),
      validation: json(r.validation),
      tokens_in: r.tokensIn ?? null,
      tokens_out: r.tokensOut ?? null,
      latency_ms: r.latencyMs ?? null,
      error: r.error ? r.error.slice(0, 4000) : null,
      finished_at: r.status === AiRunStatus.PENDING || r.status === AiRunStatus.RUNNING ? null : new Date(),
    };
  }
}
