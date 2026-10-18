import { Module } from '@nestjs/common';
import { PoliciesService } from './policies.service';
import { PoliciesController } from './policies.controller';
import { AuditLogService } from '../common/services/audit-log.service';
import { ProjectRoleGuard } from '../common/guards/project-role.guard';

@Module({
  controllers: [PoliciesController],
  providers: [PoliciesService, AuditLogService, ProjectRoleGuard],
  exports: [PoliciesService],
})
export class PoliciesModule {}
