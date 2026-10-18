import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Ip,
  Headers,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { OrganizationsService } from './organizations.service';
import {
  CreateOrganizationDto,
  OrganizationDeletionDto,
  UpdateOrganizationDto,
} from './dto/organization.dto';
import { InviteMemberDto, UpdateMemberRoleDto } from './dto/member.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { OrgRoles } from '../common/decorators/org-role.decorator';
import { OrganizationRoleGuard } from '../common/guards/organization-role.guard';
import { OrganizationRole } from '@prisma/client';

@ApiTags('Organizations')
@ApiBearerAuth()
@Controller('organizations')
export class OrganizationsController {
  constructor(private readonly organizationsService: OrganizationsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new organization' })
  @ApiResponse({ status: 201, description: 'Organization created' })
  async create(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateOrganizationDto,
    @Ip() ipAddress: string,
    @Headers('user-agent') userAgent: string,
  ) {
    return this.organizationsService.create(dto, userId, ipAddress, userAgent);
  }

  @Get()
  @ApiOperation({ summary: 'List my organizations' })
  @ApiResponse({ status: 200, description: 'List of organizations' })
  async findAll(@CurrentUser('id') userId: string) {
    return this.organizationsService.findAllForUser(userId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get organization details' })
  @ApiResponse({ status: 200, description: 'Organization details' })
  @UseGuards(OrganizationRoleGuard)
  async findOne(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.organizationsService.findOne(id, userId);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update organization' })
  @UseGuards(OrganizationRoleGuard)
  @OrgRoles(OrganizationRole.ORG_OWNER, OrganizationRole.ORG_ADMIN)
  async update(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('organizationRole') userRole: OrganizationRole,
    @Body() dto: UpdateOrganizationDto,
    @Ip() ipAddress: string,
    @Headers('user-agent') userAgent: string,
  ) {
    return this.organizationsService.update(
      id, dto, userId, userRole, ipAddress, userAgent,
    );
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete (archive) organization' })
  @UseGuards(OrganizationRoleGuard)
  @OrgRoles(OrganizationRole.ORG_OWNER)
  async remove(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('organizationRole') userRole: OrganizationRole,
    @Body() dto: OrganizationDeletionDto,
    @Ip() ipAddress: string,
    @Headers('user-agent') userAgent: string,
  ) {
    return this.organizationsService.remove(
      id, userId, userRole, dto, ipAddress, userAgent,
    );
  }

  @Post(':id/members')
  @ApiOperation({ summary: 'Add member to organization' })
  @UseGuards(OrganizationRoleGuard)
  @OrgRoles(OrganizationRole.ORG_OWNER, OrganizationRole.ORG_ADMIN)
  async addMember(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('organizationRole') userRole: OrganizationRole,
    @Body() dto: InviteMemberDto,
    @Ip() ipAddress: string,
    @Headers('user-agent') userAgent: string,
  ) {
    return this.organizationsService.addMember(
      id, dto.email, dto.role, userId, userRole, ipAddress, userAgent,
    );
  }

  @Post('join-requests/:requestId/respond')
  @ApiOperation({ summary: 'Accept or reject an organization join request' })
  async respondToJoinRequest(
    @Param('requestId') requestId: string,
    @CurrentUser('id') userId: string,
    @Body() body: { accept: boolean },
  ) {
    return this.organizationsService.respondToJoinRequest(requestId, userId, body.accept);
  }

  @Delete(':id/members/me')
  @ApiOperation({ summary: 'Leave organization' })
  @UseGuards(OrganizationRoleGuard)
  async leave(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @Ip() ipAddress: string,
    @Headers('user-agent') userAgent: string,
  ) {
    return this.organizationsService.leave(id, userId, ipAddress, userAgent);
  }

  @Delete(':id/members/:memberId')
  @ApiOperation({ summary: 'Remove member from organization' })
  @UseGuards(OrganizationRoleGuard)
  @OrgRoles(OrganizationRole.ORG_OWNER, OrganizationRole.ORG_ADMIN)
  async removeMember(
    @Param('id') id: string,
    @Param('memberId') memberId: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('organizationRole') userRole: OrganizationRole,
    @Ip() ipAddress: string,
    @Headers('user-agent') userAgent: string,
  ) {
    return this.organizationsService.removeMember(
      id, memberId, userId, userRole, ipAddress, userAgent,
    );
  }

  @Put(':id/members/:memberId/role')
  @ApiOperation({ summary: 'Change member role' })
  @UseGuards(OrganizationRoleGuard)
  @OrgRoles(OrganizationRole.ORG_OWNER)
  async updateMemberRole(
    @Param('id') id: string,
    @Param('memberId') memberId: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('organizationRole') userRole: OrganizationRole,
    @Body() dto: UpdateMemberRoleDto,
    @Ip() ipAddress: string,
    @Headers('user-agent') userAgent: string,
  ) {
    return this.organizationsService.updateMemberRole(
      id, memberId, dto.role, userId, userRole, ipAddress, userAgent,
    );
  }
}
