import { Module } from '@nestjs/common';
import { SoaService } from './soa.service';
import { SoaController } from './soa.controller';
import { AuditLogService } from '../common/services/audit-log.service';
import { StepDocumentService } from '../common/services/step-document.service';
import { TasksModule } from '../tasks/tasks.module';
import { ProjectRoleGuard } from '../common/guards/project-role.guard';

@Module({
  imports: [TasksModule],
  controllers: [SoaController],
  providers: [SoaService, AuditLogService, StepDocumentService, ProjectRoleGuard],
  exports: [SoaService],
})
export class SoaModule {}
