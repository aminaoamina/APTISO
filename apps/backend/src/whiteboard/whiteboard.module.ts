import { Module } from '@nestjs/common';
import { ProjectAccessService } from '../common/services/project-access.service';
import { ProjectRoleGuard } from '../common/guards/project-role.guard';
import { WhiteboardController } from './whiteboard.controller';
import { WhiteboardService } from './whiteboard.service';

/** Project whiteboard (basic: one board per project, last save wins). */
@Module({
  controllers: [WhiteboardController],
  providers: [WhiteboardService, ProjectAccessService, ProjectRoleGuard],
})
export class WhiteboardModule {}
