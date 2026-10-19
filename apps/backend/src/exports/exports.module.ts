import { Module } from '@nestjs/common';
import { AuditLogService } from '../common/services/audit-log.service';
import { ProjectRoleGuard } from '../common/guards/project-role.guard';
import { DocumentsModule } from '../documents/documents.module';
import { EvidenceModule } from '../evidence/evidence.module';
import { ExportsController } from './exports.controller';
import { ExportsService } from './exports.service';

@Module({
  imports: [DocumentsModule, EvidenceModule],
  controllers: [ExportsController],
  providers: [ExportsService, AuditLogService, ProjectRoleGuard],
})
export class ExportsModule {}
