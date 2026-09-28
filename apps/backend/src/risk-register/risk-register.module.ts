import { Module } from '@nestjs/common';
import { RiskRegisterService } from './risk-register.service';
import { RiskRegisterController } from './risk-register.controller';
import { AuditLogService } from '../common/services/audit-log.service';
import { ProjectRoleGuard } from '../common/guards/project-role.guard';

@Module({
  controllers: [RiskRegisterController],
  providers: [RiskRegisterService, AuditLogService, ProjectRoleGuard],
  exports: [RiskRegisterService],
})
export class RiskRegisterModule {}
