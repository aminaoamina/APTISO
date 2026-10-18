import {
  Body,
  Controller,
  Get,
  Headers,
  Ip,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ProjectRole } from '@prisma/client';
import { SoaService } from './soa.service';
import {
  ApplySuggestionsDto,
  DecisionRequestDto,
  OwnerApprovalRequestDto,
  SaveSetupDto,
  UpdateSoaControlDto,
} from './dto/soa.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ProjectRoles } from '../common/decorators/project-role.decorator';
import { ProjectRoleGuard } from '../common/guards/project-role.guard';

// Reads are open to every project member (auditors included); writes are for
// leads and members. The service re-checks membership and role.
const EDITORS = [ProjectRole.PROJECT_LEAD, ProjectRole.PROJECT_MEMBER];

@ApiTags('Statement of Applicability')
@ApiBearerAuth()
@Controller()
@UseGuards(ProjectRoleGuard)
export class SoaController {
  constructor(private readonly soa: SoaService) {}

  @Get('steps/:stepId/soa')
  @ApiOperation({ summary: 'Statement of Applicability, Risk Treatment Plan, approvals and completion' })
  get(@Param('stepId', ParseUUIDPipe) stepId: string, @CurrentUser('id') userId: string) {
    return this.soa.getSoa(stepId, userId);
  }

  @Put('steps/:stepId/soa/setup')
  @ApiOperation({ summary: 'Stage 1: save the setup answers and suggest applicability' })
  @ProjectRoles(...EDITORS)
  saveSetup(
    @Param('stepId', ParseUUIDPipe) stepId: string,
    @CurrentUser('id') userId: string,
    @Body() dto: SaveSetupDto,
    @Ip() ip: string,
    @Headers('user-agent') ua: string,
  ) {
    return this.soa.saveSetup(stepId, dto, userId, ip, ua);
  }

  @Post('steps/:stepId/soa/suggestions')
  @ApiOperation({ summary: 'Stage 2: re-apply suggestions from the risk register, requirements and setup' })
  @ProjectRoles(...EDITORS)
  refreshSuggestions(
    @Param('stepId', ParseUUIDPipe) stepId: string,
    @CurrentUser('id') userId: string,
    @Body() dto: ApplySuggestionsDto,
    @Ip() ip: string,
    @Headers('user-agent') ua: string,
  ) {
    return this.soa.refreshSuggestions(stepId, dto.overwrite ?? false, userId, ip, ua);
  }

  @Patch('soa/controls/:soaControlId')
  @ApiOperation({ summary: 'Stages 2-3: update a control (applicability, justification, method, status, plan)' })
  @ProjectRoles(...EDITORS)
  updateControl(
    @Param('soaControlId', ParseUUIDPipe) id: string,
    @CurrentUser('id') userId: string,
    @Body() dto: UpdateSoaControlDto,
    @Ip() ip: string,
    @Headers('user-agent') ua: string,
  ) {
    return this.soa.updateControl(id, dto, userId, ip, ua);
  }

  @Post('steps/:stepId/soa/treatment-plan/confirm')
  @ApiOperation({ summary: 'Stage 3: confirm the Risk Treatment Plan and create implementation tasks' })
  @ProjectRoles(...EDITORS)
  confirmPlan(
    @Param('stepId', ParseUUIDPipe) stepId: string,
    @CurrentUser('id') userId: string,
    @Ip() ip: string,
    @Headers('user-agent') ua: string,
  ) {
    return this.soa.confirmTreatmentPlan(stepId, userId, ip, ua);
  }

  @Post('soa/controls/:soaControlId/resources')
  @ApiOperation({ summary: 'Stage 4: top management approves or rejects a resource request' })
  @ProjectRoles(...EDITORS)
  decideResources(
    @Param('soaControlId', ParseUUIDPipe) id: string,
    @CurrentUser('id') userId: string,
    @Body() dto: DecisionRequestDto,
    @Ip() ip: string,
    @Headers('user-agent') ua: string,
  ) {
    return this.soa.decideResources(id, dto, userId, ip, ua);
  }

  @Post('steps/:stepId/soa/owner-approval')
  @ApiOperation({ summary: 'Stage 5: risk owner approves or rejects the plan and residual risks' })
  @ProjectRoles(...EDITORS)
  ownerApproval(
    @Param('stepId', ParseUUIDPipe) stepId: string,
    @CurrentUser('id') userId: string,
    @Body() dto: OwnerApprovalRequestDto,
    @Ip() ip: string,
    @Headers('user-agent') ua: string,
  ) {
    return this.soa.ownerApproval(stepId, dto, userId, ip, ua);
  }

  @Get('steps/:stepId/soa/documents')
  @ApiOperation({ summary: 'The Statement of Applicability document of this step' })
  documents(@Param('stepId', ParseUUIDPipe) stepId: string, @CurrentUser('id') userId: string) {
    return this.soa.getDocuments(stepId, userId);
  }

  @Post('steps/:stepId/soa/documents')
  @ApiOperation({ summary: 'Generate (or refresh) the Statement of Applicability and Risk Treatment Plan document' })
  @ProjectRoles(...EDITORS)
  createDocument(
    @Param('stepId', ParseUUIDPipe) stepId: string,
    @CurrentUser('id') userId: string,
    @Ip() ip: string,
    @Headers('user-agent') ua: string,
  ) {
    return this.soa.createDocument(stepId, userId, ip, ua);
  }
}
