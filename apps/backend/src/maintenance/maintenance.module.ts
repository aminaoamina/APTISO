import { Module } from '@nestjs/common';
import { AuditLogService } from '../common/services/audit-log.service';
import { TaskService } from '../common/services/task.service';
import { ProjectAccessService } from '../common/services/project-access.service';
import { ProjectRoleGuard } from '../common/guards/project-role.guard';
import { MaintenanceController } from './maintenance.controller';
import { MaintenanceService } from './maintenance.service';
import { MaintenanceScheduler } from './maintenance.scheduler';

/** Phase 5: ISMS Maintenance & Certification Cycle. */
@Module({
  controllers: [MaintenanceController],
  providers: [MaintenanceService, MaintenanceScheduler, AuditLogService, TaskService, ProjectAccessService, ProjectRoleGuard],
  exports: [MaintenanceService],
})
export class MaintenanceModule {}
