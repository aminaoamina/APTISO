import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { OrganizationRole, ProjectRole } from '@prisma/client';

export class InviteMemberDto {
  @ApiProperty({ example: 'john@example.com' })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({ enum: OrganizationRole, example: OrganizationRole.ORG_MEMBER })
  @IsEnum(OrganizationRole)
  @IsNotEmpty()
  role: OrganizationRole;
}

export class UpdateMemberRoleDto {
  @ApiProperty({ enum: OrganizationRole, example: OrganizationRole.ORG_ADMIN })
  @IsEnum(OrganizationRole)
  @IsNotEmpty()
  role: OrganizationRole;
}

export class ProjectInviteMemberDto {
  @ApiProperty({ example: 'john@example.com' })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({ enum: ProjectRole, example: ProjectRole.PROJECT_MEMBER })
  @IsEnum(ProjectRole)
  @IsNotEmpty()
  privilege: ProjectRole;

  @ApiPropertyOptional({ example: 'Information Security Manager' })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  custom_role?: string;
}

export class UpdateProjectMemberDto {
  @ApiPropertyOptional({ enum: ProjectRole })
  @IsOptional()
  @IsEnum(ProjectRole)
  privilege?: ProjectRole;

  @ApiPropertyOptional({ example: 'IT Administrator' })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  custom_role?: string;
}

export class AssignIsoRolesDto {
  @ApiProperty({ example: ['INFORMATION_SECURITY_MANAGER', 'ASSET_OWNER'], type: [String] })
  @IsNotEmpty()
  iso_roles: string[];
}

export class ReviewMemberAddRequestDto {
  @ApiProperty({ enum: ['ACCEPTED', 'REJECTED'] })
  @IsEnum(['ACCEPTED', 'REJECTED'] as const)
  @IsNotEmpty()
  status: 'ACCEPTED' | 'REJECTED';
}
