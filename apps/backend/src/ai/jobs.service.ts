import { Injectable } from '@nestjs/common';
import { AiJobStatus } from '@prisma/client';
import { AiServiceClient } from './ai-service.client';

export interface AiJob<R> {
  job_id: string;
  status: 'queued' | 'running' | 'succeeded' | 'failed';
  error: string | null;
  result: R | null;
}

const STATUS: Record<AiJob<unknown>['status'], AiJobStatus> = { queued: 'QUEUED', running: 'RUNNING', succeeded: 'DONE', failed: 'FAILED' };

export const isActive = (status: AiJobStatus) => status === 'QUEUED' || status === 'RUNNING';

/**
 * Long AI tasks run as jobs of the AI service. A job is identified by an
 * idempotency key (submitting twice returns the same job); its result is read
 * back here and saved by the feature, once.
 */
@Injectable()
export class AiJobsService {
  constructor(private readonly ai: AiServiceClient) {}

  async submit<R>(kind: 'review' | 'evidence', idempotencyKey: string, projectId: string, userId: string, payload: unknown) {
    const job = await this.ai.request<AiJob<R>>('POST', '/v1/jobs', { kind, idempotency_key: idempotencyKey, project_id: projectId, user_id: userId, payload }, { timeoutMs: 30_000 });
    return { ...job, status: STATUS[job.status] };
  }

  async get<R>(jobId: string, projectId: string) {
    const job = await this.ai.request<AiJob<R>>('GET', `/v1/jobs/${jobId}?project_id=${projectId}`, undefined, { timeoutMs: 10_000 });
    return { ...job, status: STATUS[job.status] };
  }
}
