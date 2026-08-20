import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { InvitationsService } from '../organizations/invitations.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';

@ApiTags('Invitations')
@Controller('invitations')
export class InvitationPublicController {
  constructor(private readonly invitationsService: InvitationsService) {}

  @Public()
  @Get('validate/:token')
  @ApiOperation({ summary: 'Validate invitation token' })
  @ApiResponse({ status: 200, description: 'Invitation details' })
  async validateInvitation(@Param('token') token: string) {
    return this.invitationsService.validateInvitation(token);
  }

  @Post('accept')
  @ApiOperation({ summary: 'Accept invitation (authenticated)' })
  @ApiResponse({ status: 200, description: 'Invitation accepted' })
  async acceptInvitation(
    @Body('token') token: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.invitationsService.acceptInvitation(token, userId);
  }
}
