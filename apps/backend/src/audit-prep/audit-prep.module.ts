import { Module } from '@nestjs/common';
import { AuditLogService } from '../common/services/audit-log.service';
import { TaskService } from '../common/services/task.service';
import { ProjectAccessService } from '../common/services/project-access.service';
import { StepDocumentService } from '../common/services/step-document.service';
import { ProjectRoleGuard } from '../common/guards/project-role.guard';
import { AuditPrepController } from './audit-prep.controller';
import { ImprovementService } from './improvement.service';
import { TrainingsService } from './trainings.service';
import { ObjectivesService } from './objectives.service';
import { InternalAuditService } from './internal-audit.service';
import { ManagementReviewService } from './management-review.service';

/** Phase 4: Preparation for External Audit. */
@Module({
  controllers: [AuditPrepController],
  providers: [
    AuditLogService,
    TaskService,
    ProjectAccessService,
    StepDocumentService,
    ProjectRoleGuard,
    ImprovementService,
    TrainingsService,
    ObjectivesService,
    InternalAuditService,
    ManagementReviewService,
  ],
  exports: [TrainingsService, ObjectivesService, InternalAuditService, ManagementReviewService],
})
export class AuditPrepModule {}
