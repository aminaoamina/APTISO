import { Module } from '@nestjs/common';
import { AuditLogService } from '../common/services/audit-log.service';
import { ProjectRoleGuard } from '../common/guards/project-role.guard';
import { EvidenceController } from './evidence.controller';
import { EvidenceService } from './evidence.service';
import { AuditMapService } from './audit-map.service';
import { FileStorage, LocalDiskStorage } from './file-storage';

@Module({
  controllers: [EvidenceController],
  providers: [EvidenceService, AuditMapService, AuditLogService, ProjectRoleGuard, { provide: FileStorage, useClass: LocalDiskStorage }],
})
export class EvidenceModule {}
