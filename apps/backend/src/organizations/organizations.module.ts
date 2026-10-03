import { Module } from '@nestjs/common';
import { OrganizationsService } from './organizations.service';
import { OrganizationsController } from './organizations.controller';
import { AuditLogService } from '../common/services/audit-log.service';
import { OrganizationRoleGuard } from '../common/guards/organization-role.guard';
import { MailModule } from '../mail/mail.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [MailModule, NotificationsModule],
  controllers: [OrganizationsController],
  providers: [OrganizationsService, AuditLogService, OrganizationRoleGuard],
  exports: [OrganizationsService],
})
export class OrganizationsModule {}
