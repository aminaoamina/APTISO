import { Body, Controller, Get, Param, ParseUUIDPipe, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiTags } from '@nestjs/swagger';
import { ProjectRole } from '@prisma/client';
import { IsObject } from 'class-validator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ProjectRoles } from '../common/decorators/project-role.decorator';
import { ProjectRoleGuard } from '../common/guards/project-role.guard';
import { WhiteboardService } from './whiteboard.service';

class SaveWhiteboardDto {
  @ApiProperty({ description: 'The tldraw snapshot (document and session state)' }) @IsObject() snapshot!: Record<string, unknown>;
}

@ApiTags('Whiteboard')
@ApiBearerAuth()
@Controller('projects/:projectId/whiteboard')
@UseGuards(ProjectRoleGuard)
export class WhiteboardController {
  constructor(private readonly boards: WhiteboardService) {}

  @Get()
  @ApiOperation({ summary: "The project's whiteboard" })
  get(@Param('projectId', ParseUUIDPipe) projectId: string, @CurrentUser('id') userId: string) {
    return this.boards.get(projectId, userId);
  }

  @Put()
  @ProjectRoles(ProjectRole.PROJECT_LEAD, ProjectRole.PROJECT_MEMBER)
  @ApiOperation({ summary: "Save the project's whiteboard" })
  save(@Param('projectId', ParseUUIDPipe) projectId: string, @Body() dto: SaveWhiteboardDto, @CurrentUser('id') userId: string) {
    return this.boards.save(projectId, userId, dto.snapshot);
  }
}
