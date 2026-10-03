import { Module } from '@nestjs/common';
import { DocumentsController } from './documents.controller';
import { DocumentsService } from './documents.service';
import { DocxExportService } from './docx-export.service';
import { LibraryService } from './library.service';
import { AuditLogService } from '../common/services/audit-log.service';
import { ProjectRoleGuard } from '../common/guards/project-role.guard';
import { OrganizationRoleGuard } from '../common/guards/organization-role.guard';
import { TasksModule } from '../tasks/tasks.module';

@Module({
  imports: [TasksModule],
  controllers: [DocumentsController],
  providers: [DocumentsService, DocxExportService, LibraryService, AuditLogService, ProjectRoleGuard, OrganizationRoleGuard],
  exports: [DocumentsService],
})
export class DocumentsModule {}
