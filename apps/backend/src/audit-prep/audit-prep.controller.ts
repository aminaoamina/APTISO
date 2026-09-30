import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ProjectRole } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ProjectRoles } from '../common/decorators/project-role.decorator';
import { ProjectRoleGuard } from '../common/guards/project-role.guard';
import { ImprovementService } from './improvement.service';
import { TrainingsService } from './trainings.service';
import { ObjectivesService } from './objectives.service';
import { InternalAuditService } from './internal-audit.service';
import { ManagementReviewService } from './management-review.service';
import {
  CreateActionDto,
  CreateIncidentDto,
  CreateNonconformityDto,
  NotRelevantDto,
  ResolveNonconformityDto,
  UpdateActionDto,
  UpdateIncidentDto,
  UpdateNonconformityDto,
} from './dto/improvement.dto';
import {
  AuditReportDto,
  CreateAuditDto,
  CreateReviewDto,
  CreateTrainingDto,
  DecisionDto,
  MeasurementDto,
  ObjectiveDto,
  ReviewSetupDto,
  UpdateAuditDto,
  UpdateAuditItemDto,
  UpdateDecisionDto,
  UpdateObjectiveDto,
  UpdateReviewDto,
  UpdateReviewInputDto,
  UpdateTrainingDto,
} from './dto/audit-prep.dto';

// Reads are open to every project member (auditors included); writes are for
// leads and members. Services re-check membership, and top management
// decisions (approvals) additionally require the Top management role or lead.
const EDITORS = [ProjectRole.PROJECT_LEAD, ProjectRole.PROJECT_MEMBER];
const uuid = ParseUUIDPipe;

@ApiTags('Preparation for External Audit')
@ApiBearerAuth()
@Controller()
@UseGuards(ProjectRoleGuard)
export class AuditPrepController {
  constructor(
    private readonly improvement: ImprovementService,
    private readonly trainings: TrainingsService,
    private readonly objectives: ObjectivesService,
    private readonly audits: InternalAuditService,
    private readonly reviews: ManagementReviewService,
  ) {}

  // ─── Nonconformity, corrective action and incident registers ───

  @Get('projects/:projectId/registers')
  @ApiOperation({ summary: 'Nonconformity (with corrective actions) and incident registers' })
  registers(@Param('projectId', uuid) p: string, @CurrentUser('id') u: string) {
    return this.improvement.getRegisters(p, u);
  }

  @Post('projects/:projectId/nonconformities') @ProjectRoles(...EDITORS)
  createNc(@Param('projectId', uuid) p: string, @Body() dto: CreateNonconformityDto, @CurrentUser('id') u: string) {
    return this.improvement.createNonconformity(p, dto, u);
  }

  @Patch('projects/:projectId/nonconformities/:ncId') @ProjectRoles(...EDITORS)
  updateNc(@Param('projectId', uuid) p: string, @Param('ncId', uuid) id: string, @Body() dto: UpdateNonconformityDto, @CurrentUser('id') u: string) {
    return this.improvement.updateNonconformity(p, id, dto, u);
  }

  @Post('projects/:projectId/nonconformities/:ncId/actions') @ProjectRoles(...EDITORS)
  addAction(@Param('projectId', uuid) p: string, @Param('ncId', uuid) id: string, @Body() dto: CreateActionDto, @CurrentUser('id') u: string) {
    return this.improvement.addAction(p, id, dto, u);
  }

  @Patch('projects/:projectId/nonconformities/:ncId/actions/:actionId') @ProjectRoles(...EDITORS)
  updateAction(@Param('projectId', uuid) p: string, @Param('ncId', uuid) id: string, @Param('actionId', uuid) a: string, @Body() dto: UpdateActionDto, @CurrentUser('id') u: string) {
    return this.improvement.updateAction(p, id, a, dto, u);
  }

  @Delete('projects/:projectId/nonconformities/:ncId/actions/:actionId') @ProjectRoles(...EDITORS)
  removeAction(@Param('projectId', uuid) p: string, @Param('ncId', uuid) id: string, @Param('actionId', uuid) a: string, @CurrentUser('id') u: string) {
    return this.improvement.removeAction(p, id, a, u);
  }

  @Post('projects/:projectId/nonconformities/:ncId/resolve') @ProjectRoles(...EDITORS)
  resolveNc(@Param('projectId', uuid) p: string, @Param('ncId', uuid) id: string, @Body() dto: ResolveNonconformityDto, @CurrentUser('id') u: string) {
    return this.improvement.resolve(p, id, dto, u);
  }

  @Post('projects/:projectId/nonconformities/:ncId/not-relevant') @ProjectRoles(...EDITORS)
  notRelevant(@Param('projectId', uuid) p: string, @Param('ncId', uuid) id: string, @Body() dto: NotRelevantDto, @CurrentUser('id') u: string) {
    return this.improvement.markNotRelevant(p, id, dto, u);
  }

  @Post('projects/:projectId/nonconformities/:ncId/reopen') @ProjectRoles(...EDITORS)
  reopenNc(@Param('projectId', uuid) p: string, @Param('ncId', uuid) id: string, @CurrentUser('id') u: string) {
    return this.improvement.reopen(p, id, u);
  }

  @Post('projects/:projectId/incidents') @ProjectRoles(...EDITORS)
  createIncident(@Param('projectId', uuid) p: string, @Body() dto: CreateIncidentDto, @CurrentUser('id') u: string) {
    return this.improvement.createIncident(p, dto, u);
  }

  @Patch('projects/:projectId/incidents/:incidentId') @ProjectRoles(...EDITORS)
  updateIncident(@Param('projectId', uuid) p: string, @Param('incidentId', uuid) id: string, @Body() dto: UpdateIncidentDto, @CurrentUser('id') u: string) {
    return this.improvement.updateIncident(p, id, dto, u);
  }

  @Post('projects/:projectId/incidents/:incidentId/nonconformity') @ProjectRoles(...EDITORS)
  ncFromIncident(@Param('projectId', uuid) p: string, @Param('incidentId', uuid) id: string, @CurrentUser('id') u: string) {
    return this.improvement.nonconformityFromIncident(p, id, u);
  }

  // ─── Step 3: training plan ─────────────────────────────────────

  @Get('steps/:stepId/trainings')
  getTrainings(@Param('stepId', uuid) s: string, @CurrentUser('id') u: string) {
    return this.trainings.get(s, u);
  }

  @Post('steps/:stepId/trainings') @ProjectRoles(...EDITORS)
  createTraining(@Param('stepId', uuid) s: string, @Body() dto: CreateTrainingDto, @CurrentUser('id') u: string) {
    return this.trainings.create(s, dto, u);
  }

  @Post('steps/:stepId/trainings/import') @ProjectRoles(...EDITORS)
  @ApiOperation({ summary: 'Import the training needs entered in the steps' })
  importNeeds(@Param('stepId', uuid) s: string, @CurrentUser('id') u: string) {
    return this.trainings.importNeeds(s, u);
  }

  @Post('steps/:stepId/trainings/document') @ProjectRoles(...EDITORS)
  trainingDocument(@Param('stepId', uuid) s: string, @CurrentUser('id') u: string) {
    return this.trainings.createDocument(s, u);
  }

  @Patch('steps/:stepId/trainings/:trainingId') @ProjectRoles(...EDITORS)
  updateTraining(@Param('stepId', uuid) s: string, @Param('trainingId', uuid) t: string, @Body() dto: UpdateTrainingDto, @CurrentUser('id') u: string) {
    return this.trainings.update(s, t, dto, u);
  }

  @Post('steps/:stepId/trainings/:trainingId/approve') @ProjectRoles(...EDITORS)
  approveTraining(@Param('stepId', uuid) s: string, @Param('trainingId', uuid) t: string, @CurrentUser('id') u: string) {
    return this.trainings.approve(s, t, u);
  }

  @Delete('steps/:stepId/trainings/:trainingId') @ProjectRoles(...EDITORS)
  removeTraining(@Param('stepId', uuid) s: string, @Param('trainingId', uuid) t: string, @CurrentUser('id') u: string) {
    return this.trainings.remove(s, t, u);
  }

  // ─── Step 4: security objectives ───────────────────────────────

  @Get('steps/:stepId/objectives')
  getObjectives(@Param('stepId', uuid) s: string, @CurrentUser('id') u: string) {
    return this.objectives.get(s, u);
  }

  @Post('steps/:stepId/objectives') @ProjectRoles(...EDITORS)
  createObjective(@Param('stepId', uuid) s: string, @Body() dto: ObjectiveDto, @CurrentUser('id') u: string) {
    return this.objectives.create(s, dto, u);
  }

  @Post('steps/:stepId/objectives/confirm') @ProjectRoles(...EDITORS)
  @ApiOperation({ summary: 'Top management approves the objectives' })
  confirmObjectives(@Param('stepId', uuid) s: string, @CurrentUser('id') u: string) {
    return this.objectives.confirm(s, u);
  }

  @Post('steps/:stepId/objectives/document') @ProjectRoles(...EDITORS)
  objectivesDocument(@Param('stepId', uuid) s: string, @CurrentUser('id') u: string) {
    return this.objectives.createDocument(s, u);
  }

  @Patch('steps/:stepId/objectives/:objectiveId') @ProjectRoles(...EDITORS)
  updateObjective(@Param('stepId', uuid) s: string, @Param('objectiveId', uuid) o: string, @Body() dto: UpdateObjectiveDto, @CurrentUser('id') u: string) {
    return this.objectives.update(s, o, dto, u);
  }

  @Delete('steps/:stepId/objectives/:objectiveId') @ProjectRoles(...EDITORS)
  removeObjective(@Param('stepId', uuid) s: string, @Param('objectiveId', uuid) o: string, @CurrentUser('id') u: string) {
    return this.objectives.remove(s, o, u);
  }

  @Post('steps/:stepId/objectives/:objectiveId/measurements') @ProjectRoles(...EDITORS)
  measure(@Param('stepId', uuid) s: string, @Param('objectiveId', uuid) o: string, @Body() dto: MeasurementDto, @CurrentUser('id') u: string) {
    return this.objectives.addMeasurement(s, o, dto, u);
  }

  // ─── Step 6: internal audit ────────────────────────────────────

  @Get('steps/:stepId/audits')
  getAudits(@Param('stepId', uuid) s: string, @CurrentUser('id') u: string) {
    return this.audits.get(s, u);
  }

  @Post('steps/:stepId/audits') @ProjectRoles(...EDITORS)
  @ApiOperation({ summary: 'Schedule an internal audit (checklist: clauses 4-10 and applicable SoA controls)' })
  createAudit(@Param('stepId', uuid) s: string, @Body() dto: CreateAuditDto, @CurrentUser('id') u: string) {
    return this.audits.create(s, dto, u);
  }

  @Post('steps/:stepId/audits/document') @ProjectRoles(...EDITORS)
  auditDocument(@Param('stepId', uuid) s: string, @CurrentUser('id') u: string) {
    return this.audits.createDocument(s, u);
  }

  @Patch('steps/:stepId/audits/:auditId') @ProjectRoles(...EDITORS)
  updateAudit(@Param('stepId', uuid) s: string, @Param('auditId', uuid) a: string, @Body() dto: UpdateAuditDto, @CurrentUser('id') u: string) {
    return this.audits.update(s, a, dto, u);
  }

  @Delete('steps/:stepId/audits/:auditId') @ProjectRoles(...EDITORS)
  removeAudit(@Param('stepId', uuid) s: string, @Param('auditId', uuid) a: string, @CurrentUser('id') u: string) {
    return this.audits.remove(s, a, u);
  }

  @Post('steps/:stepId/audits/:auditId/start') @ProjectRoles(...EDITORS)
  startAudit(@Param('stepId', uuid) s: string, @Param('auditId', uuid) a: string, @CurrentUser('id') u: string) {
    return this.audits.start(s, a, u);
  }

  @Patch('steps/:stepId/audits/:auditId/items/:itemId') @ProjectRoles(...EDITORS)
  updateAuditItem(@Param('stepId', uuid) s: string, @Param('auditId', uuid) a: string, @Param('itemId', uuid) i: string, @Body() dto: UpdateAuditItemDto, @CurrentUser('id') u: string) {
    return this.audits.updateItem(s, a, i, dto, u);
  }

  @Post('steps/:stepId/audits/:auditId/report') @ProjectRoles(...EDITORS)
  reportAudit(@Param('stepId', uuid) s: string, @Param('auditId', uuid) a: string, @Body() dto: AuditReportDto, @CurrentUser('id') u: string) {
    return this.audits.report(s, a, dto, u);
  }

  @Post('steps/:stepId/audits/:auditId/approve') @ProjectRoles(...EDITORS)
  approveAudit(@Param('stepId', uuid) s: string, @Param('auditId', uuid) a: string, @CurrentUser('id') u: string) {
    return this.audits.approve(s, a, u);
  }

  // ─── Step 5: management review setup ───────────────────────────

  @Get('steps/:stepId/review-setup')
  getReviewSetup(@Param('stepId', uuid) s: string, @CurrentUser('id') u: string) {
    return this.reviews.getSetup(s, u);
  }

  @Put('steps/:stepId/review-setup') @ProjectRoles(...EDITORS)
  saveReviewSetup(@Param('stepId', uuid) s: string, @Body() dto: ReviewSetupDto, @CurrentUser('id') u: string) {
    return this.reviews.saveSetup(s, dto, u);
  }

  // ─── Step 7: management review ─────────────────────────────────

  @Get('steps/:stepId/reviews')
  getReviews(@Param('stepId', uuid) s: string, @CurrentUser('id') u: string) {
    return this.reviews.getReviews(s, u);
  }

  @Post('steps/:stepId/reviews') @ProjectRoles(...EDITORS)
  @ApiOperation({ summary: 'Start a management review (inputs pre-filled from the ISMS modules)' })
  createReview(@Param('stepId', uuid) s: string, @Body() dto: CreateReviewDto, @CurrentUser('id') u: string) {
    return this.reviews.createReview(s, dto, u);
  }

  @Post('steps/:stepId/reviews/document') @ProjectRoles(...EDITORS)
  reviewDocument(@Param('stepId', uuid) s: string, @CurrentUser('id') u: string) {
    return this.reviews.createDocument(s, u);
  }

  @Patch('steps/:stepId/reviews/:reviewId') @ProjectRoles(...EDITORS)
  updateReview(@Param('stepId', uuid) s: string, @Param('reviewId', uuid) r: string, @Body() dto: UpdateReviewDto, @CurrentUser('id') u: string) {
    return this.reviews.updateReview(s, r, dto, u);
  }

  @Post('steps/:stepId/reviews/:reviewId/refresh') @ProjectRoles(...EDITORS)
  refreshReview(@Param('stepId', uuid) s: string, @Param('reviewId', uuid) r: string, @CurrentUser('id') u: string) {
    return this.reviews.refreshInputs(s, r, u);
  }

  @Patch('steps/:stepId/reviews/:reviewId/inputs/:inputId') @ProjectRoles(...EDITORS)
  updateReviewInput(@Param('stepId', uuid) s: string, @Param('reviewId', uuid) r: string, @Param('inputId', uuid) i: string, @Body() dto: UpdateReviewInputDto, @CurrentUser('id') u: string) {
    return this.reviews.updateInput(s, r, i, dto, u);
  }

  @Post('steps/:stepId/reviews/:reviewId/decisions') @ProjectRoles(...EDITORS)
  addDecision(@Param('stepId', uuid) s: string, @Param('reviewId', uuid) r: string, @Body() dto: DecisionDto, @CurrentUser('id') u: string) {
    return this.reviews.addDecision(s, r, dto, u);
  }

  @Patch('steps/:stepId/reviews/:reviewId/decisions/:decisionId') @ProjectRoles(...EDITORS)
  updateDecision(@Param('stepId', uuid) s: string, @Param('reviewId', uuid) r: string, @Param('decisionId', uuid) d: string, @Body() dto: UpdateDecisionDto, @CurrentUser('id') u: string) {
    return this.reviews.updateDecision(s, r, d, dto, u);
  }

  @Delete('steps/:stepId/reviews/:reviewId/decisions/:decisionId') @ProjectRoles(...EDITORS)
  removeDecision(@Param('stepId', uuid) s: string, @Param('reviewId', uuid) r: string, @Param('decisionId', uuid) d: string, @CurrentUser('id') u: string) {
    return this.reviews.removeDecision(s, r, d, u);
  }

  @Post('steps/:stepId/reviews/:reviewId/complete') @ProjectRoles(...EDITORS)
  completeReview(@Param('stepId', uuid) s: string, @Param('reviewId', uuid) r: string, @CurrentUser('id') u: string) {
    return this.reviews.completeReview(s, r, u);
  }
}
