import { Module } from '@nestjs/common';
import { AuditLogService } from '../common/services/audit-log.service';
import { TasksModule } from '../tasks/tasks.module';
import { AuditPrepModule } from '../audit-prep/audit-prep.module';
import { StepDocumentService } from '../common/services/step-document.service';
import { ProjectAccessService } from '../common/services/project-access.service';
import { ProjectRoleGuard } from '../common/guards/project-role.guard';
import { MaintenanceController } from './maintenance.controller';
import { MaintenanceService } from './maintenance.service';
import { MaintenanceScheduler } from './maintenance.scheduler';
import { AuditProgramService } from './audit-program.service';

/** Phase 5: ISMS Maintenance & Certification Cycle. */
@Module({
  imports: [TasksModule, AuditPrepModule],
  controllers: [MaintenanceController],
  providers: [MaintenanceService, AuditProgramService, MaintenanceScheduler, AuditLogService, ProjectAccessService, StepDocumentService, ProjectRoleGuard],
  exports: [MaintenanceService],
})
export class MaintenanceModule {}
