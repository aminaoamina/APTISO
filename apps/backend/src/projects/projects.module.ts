import { Module } from '@nestjs/common';
import { ProjectsService } from './projects.service';
import { ProjectsController, ProjectDetailController, TasksController } from './projects.controller';
import { AuditLogService } from '../common/services/audit-log.service';
import { OrganizationRoleGuard } from '../common/guards/organization-role.guard';
import { ProjectRoleGuard } from '../common/guards/project-role.guard';
import { RiskRegisterModule } from '../risk-register/risk-register.module';

@Module({
  imports: [RiskRegisterModule],
  controllers: [ProjectsController, ProjectDetailController, TasksController],
  providers: [
    ProjectsService,
    AuditLogService,
    OrganizationRoleGuard,
    ProjectRoleGuard,
  ],
  exports: [ProjectsService],
})
export class ProjectsModule {}