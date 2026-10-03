import { Module } from '@nestjs/common';
import { AuditLogService } from '../common/services/audit-log.service';
import { ProjectRoleGuard } from '../common/guards/project-role.guard';
import { NotificationsModule } from '../notifications/notifications.module';
import { RequestsController } from './requests.controller';
import { RequestsService } from './requests.service';

@Module({
  imports: [NotificationsModule],
  controllers: [RequestsController],
  providers: [RequestsService, AuditLogService, ProjectRoleGuard],
})
export class RequestsModule {}
