import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { NotificationsService } from './notifications.service';

export class MarkNotificationsReadDto {
  @ApiPropertyOptional({ description: 'Notifications to mark as read; all when omitted', type: [String] })
  @IsOptional()
  @IsUUID('all', { each: true })
  ids?: string[];
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

  @Post('read')
  @ApiOperation({ summary: 'Mark notifications as read (all when no ids are given)' })
  markRead(@CurrentUser('id') userId: string, @Body() dto: MarkNotificationsReadDto) {
    return this.notifications.markRead(userId, dto.ids);
  }
}
