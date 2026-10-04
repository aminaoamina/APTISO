import { Module } from '@nestjs/common';
import { AuditLogService } from '../common/services/audit-log.service';
import { OrganizationRoleGuard } from '../common/guards/organization-role.guard';
import { ConnectorsController } from './connectors.controller';
import { DriveSyncService } from './drive-sync.service';
import { GoogleDriveClient } from './google-drive.client';
import { SecretBox } from './secret-box';

@Module({
  controllers: [ConnectorsController],
  providers: [DriveSyncService, GoogleDriveClient, SecretBox, AuditLogService, OrganizationRoleGuard],
  exports: [DriveSyncService],
})
export class ConnectorsModule {}
