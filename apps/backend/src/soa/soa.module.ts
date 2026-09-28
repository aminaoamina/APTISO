import { Module } from '@nestjs/common';
import { SoaService } from './soa.service';
import { SoaController } from './soa.controller';
import { AuditLogService } from '../common/services/audit-log.service';
import { TaskService } from '../common/services/task.service';
import { ProjectRoleGuard } from '../common/guards/project-role.guard';

@Module({
  controllers: [SoaController],
  providers: [SoaService, AuditLogService, TaskService, ProjectRoleGuard],
  exports: [SoaService],
})
export class SoaModule {}
