import { Body, Controller, Get, Post, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsUUID } from 'class-validator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { NotificationsService } from './notifications.service';

export class MarkNotificationsReadDto {
  @ApiPropertyOptional({ description: 'Notifications to mark as read; all when omitted', type: [String] })
  @IsOptional()
  @IsUUID('all', { each: true })
  ids?: string[];
}

export class NotificationSettingsDto {
  @ApiPropertyOptional({ description: 'Notification e-mails (the bell in the app stays on)' })
  @IsOptional()
  @IsBoolean()
  email_notifications?: boolean;

  @ApiPropertyOptional({ description: 'The Monday weekly digest e-mail' })
  @IsOptional()
  @IsBoolean()
  weekly_digest?: boolean;
}

@ApiTags('Notifications')
@ApiBearerAuth()
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  @ApiOperation({ summary: 'My latest notifications and the unread count' })
  list(@CurrentUser('id') userId: string) {
    return this.notifications.list(userId);
  }

  @Get('settings')
  settings(@CurrentUser('id') userId: string) {
    return this.notifications.settings(userId);
  }

  @Put('settings')
  updateSettings(@CurrentUser('id') userId: string, @Body() dto: NotificationSettingsDto) {
    return this.notifications.updateSettings(userId, dto);
  }

  @Post('read')
  @ApiOperation({ summary: 'Mark notifications as read (all when no ids are given)' })
  markRead(@CurrentUser('id') userId: string, @Body() dto: MarkNotificationsReadDto) {
    return this.notifications.markRead(userId, dto.ids);
  }
}
