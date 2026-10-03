import { Module } from '@nestjs/common';
import { ProjectsService } from './projects.service';
import { ProjectsController, ProjectDetailController } from './projects.controller';
import { AuditLogService } from '../common/services/audit-log.service';
import { OrganizationRoleGuard } from '../common/guards/organization-role.guard';
import { ProjectRoleGuard } from '../common/guards/project-role.guard';
import { RiskRegisterModule } from '../risk-register/risk-register.module';
import { SoaModule } from '../soa/soa.module';
import { PoliciesModule } from '../policies/policies.module';
import { AuditPrepModule } from '../audit-prep/audit-prep.module';
import { MaintenanceModule } from '../maintenance/maintenance.module';
import { TasksModule } from '../tasks/tasks.module';

@Module({
  imports: [RiskRegisterModule, SoaModule, PoliciesModule, AuditPrepModule, MaintenanceModule, TasksModule],
  controllers: [ProjectsController, ProjectDetailController],
  providers: [
    ProjectsService,
    AuditLogService,
    OrganizationRoleGuard,
    ProjectRoleGuard,
  ],
  exports: [ProjectsService],
})
export class ProjectsModule {}