import { Body, Controller, Get, Headers, Ip, Param, Patch, Post, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ProjectRole } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ProjectRoles } from '../common/decorators/project-role.decorator';
import { ProjectRoleGuard } from '../common/guards/project-role.guard';
import { AssignTaskDto, CompleteTaskDto, UpdateTaskDto } from './dto/task.dto';
import { TasksService } from './tasks.service';

@ApiTags('Tasks')
@ApiBearerAuth()
@Controller()
export class TasksController {
  constructor(private readonly tasks: TasksService) {}

  @Get('tasks/mine')
  @ApiOperation({ summary: 'Tasks assigned to me' })
  mine(@CurrentUser('id') userId: string) {
    return this.tasks.mine(userId);
  }

  @Get('tasks/team')
  @ApiOperation({ summary: 'Tasks I assigned to others and tasks of the projects I lead' })
  team(@CurrentUser('id') userId: string) {
    return this.tasks.team(userId);
  }

  @Put('tasks/:taskId/complete')
  @ApiOperation({ summary: 'Complete a task assigned to me' })
  complete(
    @Param('taskId') taskId: string,
    @CurrentUser('id') userId: string,
    @Body() dto: CompleteTaskDto,
    @Ip() ipAddress: string,
    @Headers('user-agent') userAgent: string,
  ) {
    return this.tasks.complete(taskId, userId, dto.notes, ipAddress, userAgent);
  }

  @Patch('tasks/:taskId')
  @ApiOperation({ summary: 'Reassign a task or change its deadline' })
  update(
    @Param('taskId') taskId: string,
    @CurrentUser('id') userId: string,
    @Body() dto: UpdateTaskDto,
    @Ip() ipAddress: string,
    @Headers('user-agent') userAgent: string,
  ) {
    return this.tasks.update(taskId, dto, userId, ipAddress, userAgent);
  }

  @Post('tasks/:taskId/cancel')
  @ApiOperation({ summary: 'Cancel a task' })
  cancel(
    @Param('taskId') taskId: string,
    @CurrentUser('id') userId: string,
    @Ip() ipAddress: string,
    @Headers('user-agent') userAgent: string,
  ) {
    return this.tasks.cancel(taskId, userId, ipAddress, userAgent);
  }

  @Get('projects/:projectId/tasks')
  @ApiOperation({ summary: 'All tasks of a project' })
  @UseGuards(ProjectRoleGuard)
  forProject(@Param('projectId') projectId: string) {
    return this.tasks.forProject(projectId);
  }

  @Post('projects/:projectId/steps/:stepId/assign')
  @ApiOperation({ summary: 'Assign someone to work on, review or approve the step document' })
  @UseGuards(ProjectRoleGuard)
  @ProjectRoles(ProjectRole.PROJECT_LEAD, ProjectRole.PROJECT_MEMBER)
  assign(
    @Param('projectId') projectId: string,
    @Param('stepId') stepId: string,
    @CurrentUser('id') userId: string,
    @Body() dto: AssignTaskDto,
    @Ip() ipAddress: string,
    @Headers('user-agent') userAgent: string,
  ) {
    return this.tasks.assign(projectId, stepId, dto, userId, ipAddress, userAgent);
  }
}
