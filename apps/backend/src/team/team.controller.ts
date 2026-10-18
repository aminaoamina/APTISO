import { Controller, Get, Param, ParseUUIDPipe, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ProjectRoleGuard } from '../common/guards/project-role.guard';
import { TeamService } from './team.service';

@ApiTags('Team')
@ApiBearerAuth()
@Controller('projects/:projectId/team')
@UseGuards(ProjectRoleGuard)
export class TeamController {
  constructor(private readonly team: TeamService) {}

  @Get()
  @ApiOperation({ summary: 'Members dashboard: workload per member and ISO roles nobody holds' })
  overview(@Param('projectId', ParseUUIDPipe) projectId: string, @CurrentUser('id') userId: string) {
    return this.team.overview(projectId, userId);
  }
}
