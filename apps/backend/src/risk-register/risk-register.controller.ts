import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Ip,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ProjectRole } from '@prisma/client';
import { RiskRegisterService } from './risk-register.service';
import {
  ReviewRisksDto,
  RiskApprovalRequestDto,
  SaveAssetsDto,
  SaveThreatsDto,
  SaveVulnerabilitiesDto,
  UpdateRiskDto,
} from './dto/risk.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ProjectRoles } from '../common/decorators/project-role.decorator';
import { ProjectRoleGuard } from '../common/guards/project-role.guard';

// Read routes are open to every project member (including auditors); write
// routes are limited to leads and members. The guard resolves the project
// from :stepId or :riskId, and the service re-checks membership and role.
const EDITORS = [ProjectRole.PROJECT_LEAD, ProjectRole.PROJECT_MEMBER];

@ApiTags('Risk Register')
@ApiBearerAuth()
@Controller()
@UseGuards(ProjectRoleGuard)
export class RiskRegisterController {
  constructor(private readonly riskRegisterService: RiskRegisterService) {}

  @Get('steps/:stepId/risk-register/seed')
  @ApiOperation({ summary: 'Catalogues (assets, vulnerabilities, threats, Annex A controls) and the risk scale' })
  getSeedCategories(@Param('stepId', ParseUUIDPipe) stepId: string, @CurrentUser('id') userId: string) {
    return this.riskRegisterService.getSeedCategories(stepId, userId);
  }

  @Get('steps/:stepId/risk-register')
  @ApiOperation({ summary: 'Full risk register state, summary and permissions' })
  getRegister(@Param('stepId', ParseUUIDPipe) stepId: string, @CurrentUser('id') userId: string) {
    return this.riskRegisterService.getRegister(stepId, userId);
  }

  @Post('steps/:stepId/risk-register/assets')
  @ApiOperation({ summary: 'Stage 1: save the selected assets' })
  @ProjectRoles(...EDITORS)
  saveAssets(
    @Param('stepId', ParseUUIDPipe) stepId: string,
    @CurrentUser('id') userId: string,
    @Body() dto: SaveAssetsDto,
    @Ip() ipAddress: string,
    @Headers('user-agent') userAgent: string,
  ) {
    return this.riskRegisterService.saveAssets(stepId, dto, userId, ipAddress, userAgent);
  }

  @Post('steps/:stepId/risk-register/vulnerabilities')
  @ApiOperation({ summary: 'Stage 2: save vulnerabilities per asset' })
  @ProjectRoles(...EDITORS)
  saveVulnerabilities(
    @Param('stepId', ParseUUIDPipe) stepId: string,
    @CurrentUser('id') userId: string,
    @Body() dto: SaveVulnerabilitiesDto,
    @Ip() ipAddress: string,
    @Headers('user-agent') userAgent: string,
  ) {
    return this.riskRegisterService.saveVulnerabilities(stepId, dto, userId, ipAddress, userAgent);
  }

  @Post('steps/:stepId/risk-register/threats')
  @ApiOperation({ summary: 'Stage 3: save threats per vulnerability' })
  @ProjectRoles(...EDITORS)
  saveThreats(
    @Param('stepId', ParseUUIDPipe) stepId: string,
    @CurrentUser('id') userId: string,
    @Body() dto: SaveThreatsDto,
    @Ip() ipAddress: string,
    @Headers('user-agent') userAgent: string,
  ) {
    return this.riskRegisterService.saveThreats(stepId, dto, userId, ipAddress, userAgent);
  }

  @Post('steps/:stepId/risk-register/generate')
  @ApiOperation({ summary: 'Sync the risk list with the selections (keeps existing evaluations)' })
  @ProjectRoles(...EDITORS)
  generateRisks(
    @Param('stepId', ParseUUIDPipe) stepId: string,
    @CurrentUser('id') userId: string,
    @Ip() ipAddress: string,
    @Headers('user-agent') userAgent: string,
  ) {
    return this.riskRegisterService.generateRisks(stepId, userId, ipAddress, userAgent);
  }

  @Post('steps/:stepId/risk-register/review')
  @ApiOperation({ summary: 'Stage 5: mark (or un-mark) risks as reviewed' })
  @ProjectRoles(...EDITORS)
  reviewRisks(
    @Param('stepId', ParseUUIDPipe) stepId: string,
    @CurrentUser('id') userId: string,
    @Body() dto: ReviewRisksDto,
    @Ip() ipAddress: string,
    @Headers('user-agent') userAgent: string,
  ) {
    return this.riskRegisterService.reviewRisks(stepId, dto, userId, ipAddress, userAgent);
  }

  @Patch('risk-register/risks/:riskId')
  @ApiOperation({ summary: 'Update a risk (evaluation, owners, treatment)' })
  @ProjectRoles(...EDITORS)
  updateRisk(
    @Param('riskId', ParseUUIDPipe) riskId: string,
    @CurrentUser('id') userId: string,
    @Body() dto: UpdateRiskDto,
    @Ip() ipAddress: string,
    @Headers('user-agent') userAgent: string,
  ) {
    return this.riskRegisterService.updateRisk(riskId, dto, userId, ipAddress, userAgent);
  }

  @Post('risk-register/risks/:riskId/confirm-treatment')
  @ApiOperation({ summary: 'Stage 6: confirm the treatment of an unacceptable risk' })
  @ProjectRoles(...EDITORS)
  confirmTreatment(
    @Param('riskId', ParseUUIDPipe) riskId: string,
    @CurrentUser('id') userId: string,
    @Ip() ipAddress: string,
    @Headers('user-agent') userAgent: string,
  ) {
    return this.riskRegisterService.confirmTreatment(riskId, userId, ipAddress, userAgent);
  }

  @Post('risk-register/risks/:riskId/approval')
  @ApiOperation({ summary: 'Stage 7: risk owner approves or rejects the residual risk' })
  @ProjectRoles(...EDITORS)
  approveRisk(
    @Param('riskId', ParseUUIDPipe) riskId: string,
    @CurrentUser('id') userId: string,
    @Body() dto: RiskApprovalRequestDto,
    @Ip() ipAddress: string,
    @Headers('user-agent') userAgent: string,
  ) {
    return this.riskRegisterService.approveRisk(riskId, dto, userId, ipAddress, userAgent);
  }

  @Delete('risk-register/risks/:riskId')
  @ApiOperation({ summary: 'Remove a risk permanently' })
  @ProjectRoles(...EDITORS)
  removeRisk(
    @Param('riskId', ParseUUIDPipe) riskId: string,
    @CurrentUser('id') userId: string,
    @Ip() ipAddress: string,
    @Headers('user-agent') userAgent: string,
  ) {
    return this.riskRegisterService.removeRisk(riskId, userId, ipAddress, userAgent);
  }

  @Post('risk-register/risks/:riskId/discard')
  @ApiOperation({ summary: 'Toggle a risk as discarded (kept for the record, excluded from the report)' })
  @ProjectRoles(...EDITORS)
  discardRisk(
    @Param('riskId', ParseUUIDPipe) riskId: string,
    @CurrentUser('id') userId: string,
    @Ip() ipAddress: string,
    @Headers('user-agent') userAgent: string,
  ) {
    return this.riskRegisterService.discardRisk(riskId, userId, ipAddress, userAgent);
  }

  @Get('steps/:stepId/risk-register/documents')
  @ApiOperation({ summary: 'The Risk Assessment and Treatment Report of this register' })
  getDocuments(@Param('stepId', ParseUUIDPipe) stepId: string, @CurrentUser('id') userId: string) {
    return this.riskRegisterService.getDocuments(stepId, userId);
  }

  @Post('steps/:stepId/risk-register/create-documents')
  @ApiOperation({ summary: 'Generate (or refresh) the Risk Assessment and Treatment Report' })
  @ProjectRoles(...EDITORS)
  createDocuments(
    @Param('stepId', ParseUUIDPipe) stepId: string,
    @CurrentUser('id') userId: string,
    @Ip() ipAddress: string,
    @Headers('user-agent') userAgent: string,
  ) {
    return this.riskRegisterService.createDocuments(stepId, userId, ipAddress, userAgent);
  }
}
