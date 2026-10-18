import { Controller, Get, Logger, OnModuleInit } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { AiClient } from './ai.client';
import { AI_QUEUE } from './ai.queue';
import { CatalogService } from './catalog.service';

const HEALTH_PROMPT = { id: 'health', version: 1, system: 'Reply with the single word OK.' };

const withTimeout = <T>(p: Promise<T>, ms: number) =>
  Promise.race([p, new Promise<never>((_, reject) => setTimeout(() => reject(new Error(`no answer after ${ms} ms`)), ms))]);

@ApiTags('AI')
@ApiBearerAuth()
@Controller('ai')
export class AiController implements OnModuleInit {
  private readonly logger = new Logger(AiController.name);

  constructor(
    private readonly ai: AiClient,
    private readonly catalog: CatalogService,
    private readonly prisma: PrismaService,
    @InjectQueue(AI_QUEUE) private readonly queue: Queue,
  ) {}

  /** A Redis outage must not crash the app: AI jobs wait until it is back. */
  onModuleInit() {
    let reported = false;
    this.queue.on('error', e => {
      if (!reported) this.logger.warn(`Redis unavailable for AI jobs: ${e.message}`);
      reported = true;
    });
  }

  @Get('health')
  @ApiOperation({ summary: 'AI status: models, a test call to the provider, Redis queue, pgvector, ISO catalog' })
  async health() {
    const started = Date.now();
    const [model, redis, pgvector, catalog] = await Promise.allSettled([
      this.ai.generateText('health', HEALTH_PROMPT, [{ role: 'user', content: 'ping' }]),
      withTimeout(this.queue.getJobCounts('waiting', 'active', 'failed'), 2000),
      this.prisma.$queryRaw<{ default_version: string; installed_version: string | null }[]>`
        SELECT default_version, installed_version FROM pg_available_extensions WHERE name = 'vector'`,
      this.catalog.all(),
    ]);
    const vector = pgvector.status === 'fulfilled' ? pgvector.value[0] : undefined;
    const entries = catalog.status === 'fulfilled' ? catalog.value : [];
    return {
      enabled: this.ai.enabled,
      models: this.ai.models,
      provider: model.status === 'fulfilled'
        ? { ok: true, model: model.value.model, latency_ms: Date.now() - started, answer: model.value.text.trim().slice(0, 20) }
        : { ok: false, error: (model.reason as Error).message },
      redis: redis.status === 'fulfilled' ? { ok: true, jobs: redis.value } : { ok: false, error: (redis.reason as Error).message },
      pgvector: vector ? { ok: true, available: vector.default_version, installed: vector.installed_version } : { ok: false },
      catalog: { clauses: entries.filter(e => e.kind === 'clause').length, controls: entries.filter(e => e.kind === 'control').length },
    };
  }
}
