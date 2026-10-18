import { Module } from '@nestjs/common';
import { ProjectAccessService } from '../common/services/project-access.service';
import { ProjectRoleGuard } from '../common/guards/project-role.guard';
import { AiServiceClient } from './ai-service.client';
import { AiContextService } from './context.service';
import { AiController } from './ai.controller';
import { AssistController } from './assist.controller';
import { AssistService } from './assist.service';
import { DocumentReviewController } from './review.controller';
import { DocumentReviewService } from './review.service';

/**
 * Backend side of the AI assistant: permissions and context from the business
 * data, and the client of the AI service (apps/ai), which does all the AI work.
 */
@Module({
  controllers: [AiController, AssistController, DocumentReviewController],
  providers: [AiServiceClient, AiContextService, AssistService, DocumentReviewService, ProjectAccessService, ProjectRoleGuard],
  exports: [AiServiceClient, AiContextService],
})
export class AiModule {}
