import { Module } from '@nestjs/common';
import { RequirementsController } from './requirements.controller';
import { RequirementsService } from './requirements.service';
import { AuditLogService } from '../common/services/audit-log.service';
import { StepDocumentService } from '../common/services/step-document.service';
import { ProjectRoleGuard } from '../common/guards/project-role.guard';

@Module({
  controllers: [RequirementsController],
  providers: [RequirementsService, AuditLogService, StepDocumentService, ProjectRoleGuard],
  exports: [RequirementsService],
})
export class RequirementsModule {}
