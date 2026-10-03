import { Module } from '@nestjs/common';
import { SoaService } from './soa.service';
import { SoaController } from './soa.controller';
import { AuditLogService } from '../common/services/audit-log.service';
import { StepDocumentService } from '../common/services/step-document.service';
import { TaskService } from '../common/services/task.service';
import { ProjectRoleGuard } from '../common/guards/project-role.guard';

@Module({
  controllers: [SoaController],
  providers: [SoaService, AuditLogService, TaskService, StepDocumentService, ProjectRoleGuard],
  exports: [SoaService],
})
export class SoaModule {}
