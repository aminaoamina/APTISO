import { Module } from '@nestjs/common';
import { ProjectAccessService } from '../common/services/project-access.service';
import { ProjectRoleGuard } from '../common/guards/project-role.guard';
import { TeamController } from './team.controller';
import { TeamService } from './team.service';

/** Members dashboard (read-only view of the project's people and their tasks). */
@Module({
  controllers: [TeamController],
  providers: [TeamService, ProjectAccessService, ProjectRoleGuard],
})
export class TeamModule {}
