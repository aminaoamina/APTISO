import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { ProjectAccessService } from '../common/services/project-access.service';
import { AiClient } from './ai.client';
import { AiRunService } from './ai-run.service';
import { AiContextService } from './context.service';
import { CatalogService } from './catalog.service';
import { AiController } from './ai.controller';
import { AiServiceClient } from './ai-service.client';
import { AI_QUEUE, redisConnection } from './ai.queue';

/** AI assistant core: model client, AI run log, ISO catalog, context builder and the background job queue. */
@Module({
  imports: [
    BullModule.forRootAsync({ inject: [ConfigService], useFactory: (config: ConfigService) => ({ connection: redisConnection(config) }) }),
    BullModule.registerQueue({
      name: AI_QUEUE,
      // Completed jobs are kept briefly (results live in ai_runs); failed ones longer for diagnosis.
      defaultJobOptions: { attempts: 3, backoff: { type: 'exponential', delay: 5000 }, removeOnComplete: 500, removeOnFail: 1000 },
    }),
  ],
  controllers: [AiController],
  providers: [AiServiceClient, AiClient, AiRunService, AiContextService, CatalogService, ProjectAccessService],
  exports: [AiServiceClient, AiClient, AiRunService, AiContextService, CatalogService, BullModule],
})
export class AiModule {}
