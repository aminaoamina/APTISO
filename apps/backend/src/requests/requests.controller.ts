import { Body, Controller, Get, Headers, Ip, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ProjectRole } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ProjectRoles } from '../common/decorators/project-role.decorator';
import { ProjectRoleGuard } from '../common/guards/project-role.guard';
import { CreateRequestDto, DecideRequestDto } from './requests.dto';
import { RequestsService } from './requests.service';

@ApiTags('Requests')
@ApiBearerAuth()
@Controller()
export class RequestsController {
  constructor(private readonly requests: RequestsService) {}

  @Post('projects/:projectId/steps/:stepId/requests')
  @ApiOperation({ summary: 'Ask top management for extra resources for a step' })
  @UseGuards(ProjectRoleGuard)
  @ProjectRoles(ProjectRole.PROJECT_LEAD, ProjectRole.PROJECT_MEMBER)
  create(
    @Param('projectId') projectId: string,
    @Param('stepId') stepId: string,
    @CurrentUser('id') userId: string,
    @Body() dto: CreateRequestDto,
    @Ip() ipAddress: string,
    @Headers('user-agent') userAgent: string,
  ) {
    return this.requests.create(projectId, stepId, dto, userId, ipAddress, userAgent);
  }

  @Get('projects/:projectId/requests')
  @ApiOperation({ summary: 'Resource requests of a project' })
  @UseGuards(ProjectRoleGuard)
  list(@Param('projectId') projectId: string, @CurrentUser('id') userId: string) {
    return this.requests.list(projectId, userId);
  }

  @Get('requests/awaiting-me')
  @ApiOperation({ summary: 'Pending requests waiting for my decision' })
  awaitingMe(@CurrentUser('id') userId: string) {
    return this.requests.awaitingMe(userId);
  }

  @Post('requests/:requestId/decide')
  @ApiOperation({ summary: 'Approve or reject a request' })
  @UseGuards(ProjectRoleGuard)
  decide(
    @Param('requestId') requestId: string,
    @CurrentUser('id') userId: string,
    @Body() dto: DecideRequestDto,
    @Ip() ipAddress: string,
    @Headers('user-agent') userAgent: string,
  ) {
    return this.requests.decide(requestId, dto, userId, ipAddress, userAgent);
  }
}
