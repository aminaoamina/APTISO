import { Module } from '@nestjs/common';
import { ProjectsService } from './projects.service';
import { ProjectsController, ProjectDetailController, TasksController } from './projects.controller';
import { AuditLogService } from '../common/services/audit-log.service';
import { OrganizationRoleGuard } from '../common/guards/organization-role.guard';
import { ProjectRoleGuard } from '../common/guards/project-role.guard';
import { RiskRegisterModule } from '../risk-register/risk-register.module';
import { SoaModule } from '../soa/soa.module';
import { PoliciesModule } from '../policies/policies.module';
import { AuditPrepModule } from '../audit-prep/audit-prep.module';
import { MaintenanceModule } from '../maintenance/maintenance.module';
import { TaskService } from '../common/services/task.service';

@Module({
  imports: [RiskRegisterModule, SoaModule, PoliciesModule, AuditPrepModule, MaintenanceModule],
  controllers: [ProjectsController, ProjectDetailController, TasksController],
  providers: [
    ProjectsService,
    AuditLogService,
    TaskService,
    OrganizationRoleGuard,
    ProjectRoleGuard,
  ],
  exports: [ProjectsService],
})
export class ProjectsModule {}