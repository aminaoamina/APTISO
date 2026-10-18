import { Module } from '@nestjs/common';
import { AuditLogService } from '../common/services/audit-log.service';
import { ProjectRoleGuard } from '../common/guards/project-role.guard';
import { NotificationsModule } from '../notifications/notifications.module';
import { TasksController } from './tasks.controller';
import { TasksService } from './tasks.service';

@Module({
  imports: [NotificationsModule],
  controllers: [TasksController],
  providers: [TasksService, AuditLogService, ProjectRoleGuard],
  exports: [TasksService],
})
export class TasksModule {}
