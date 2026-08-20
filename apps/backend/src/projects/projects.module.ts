import { Module } from '@nestjs/common';
import { ProjectsService } from './projects.service';
import { ProjectsController, ProjectDetailController } from './projects.controller';
import { AuditLogService } from '../common/services/audit-log.service';
import { OrganizationRoleGuard } from '../common/guards/organization-role.guard';
import { ProjectRoleGuard } from '../common/guards/project-role.guard';

@Module({
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
