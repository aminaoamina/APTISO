import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsIn,
  IsUUID,
  IsBoolean,
  MinLength,
  MaxLength,
} from 'class-validator';

export class CreateOrganizationDto {
  @ApiProperty({ example: 'Acme Corp' })
  @IsString()
  @IsNotEmpty()
  @MinLength(2, { message: 'Organization name must be at least 2 characters' })
  @MaxLength(150, { message: 'Organization name must be at most 150 characters' })
  name: string;

  @ApiPropertyOptional({ example: 'Information security consulting firm' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({ example: 'Technology' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  industry?: string;
}

export class UpdateOrganizationDto {
  @ApiPropertyOptional({ example: 'Acme Corp Updated' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(150)
  name?: string;

  @ApiPropertyOptional({ example: 'Updated description' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({ example: 'Finance' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  industry?: string;
}

export class OrganizationDeletionDto {
  @IsIn(['DELETE', 'TRANSFER'])
  action: 'DELETE' | 'TRANSFER';

  @IsOptional()
  @IsUUID()
  transfer_to_user_id?: string;

  @IsBoolean()
  leave_organization: boolean;
}
