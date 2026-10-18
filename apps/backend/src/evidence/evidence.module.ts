import { Module } from '@nestjs/common';
import { TasksModule } from '../tasks/tasks.module';
import { AuditLogService } from '../common/services/audit-log.service';
import { ProjectRoleGuard } from '../common/guards/project-role.guard';
import { EvidenceController } from './evidence.controller';
import { EvidenceService } from './evidence.service';
import { AuditMapService } from './audit-map.service';
import { FileStorage, LocalDiskStorage } from './file-storage';
import { EvidenceAnalysisController } from './evidence-analysis.controller';
import { EvidenceAnalysisService } from './evidence-analysis.service';
import { AiModule } from '../ai/ai.module';
import { ProjectAccessService } from '../common/services/project-access.service';

@Module({
  imports: [TasksModule, AiModule],
  controllers: [EvidenceController, EvidenceAnalysisController],
  exports: [EvidenceService],
  providers: [EvidenceService, EvidenceAnalysisService, AuditMapService, AuditLogService, ProjectAccessService, ProjectRoleGuard, { provide: FileStorage, useClass: LocalDiskStorage }],
})
export class EvidenceModule {}
