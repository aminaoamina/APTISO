import { Module } from '@nestjs/common';
import { OrganizationsService } from './organizations.service';
import { OrganizationsController } from './organizations.controller';
import { AuditLogService } from '../common/services/audit-log.service';
import { OrganizationRoleGuard } from '../common/guards/organization-role.guard';

@Module({
  controllers: [OrganizationsController],
  providers: [OrganizationsService, AuditLogService, OrganizationRoleGuard],
  exports: [OrganizationsService],
})
export class OrganizationsModule {}
