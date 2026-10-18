import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  IsDateString,
  MaxLength,
} from 'class-validator';

export enum RequirementTypeDto {
  CONTRACTUAL = 'CONTRACTUAL',
  LEGAL_REGULATORY = 'LEGAL_REGULATORY',
  OTHER = 'OTHER',
}

export enum ComplianceStatusDto {
  NON_COMPLIANT = 'NON_COMPLIANT',
  COMPLIANT = 'COMPLIANT',
}

export class CreateRequirementDto {
  @ApiProperty({ enum: RequirementTypeDto })
  @IsEnum(RequirementTypeDto)
  requirement_type!: RequirementTypeDto;

  @ApiProperty({ enum: ComplianceStatusDto })
  @IsEnum(ComplianceStatusDto)
  status!: ComplianceStatusDto;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  @MaxLength(500)
  interested_party!: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  description!: string;

  @ApiProperty()
  @IsUUID()
  responsible_person_id!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  related_area?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  deadline?: string;

  // Contractual & Other
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  document_stipulating?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  date_of_document?: string;

  // Legal/Regulatory
  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  valid_from?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  country?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  state?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  link?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  law_regulation_name?: string;
}

export class UpdateRequirementDto {
  @ApiPropertyOptional({ enum: RequirementTypeDto })
  @IsOptional()
  @IsEnum(RequirementTypeDto)
  requirement_type?: RequirementTypeDto;

  @ApiPropertyOptional({ enum: ComplianceStatusDto })
  @IsOptional()
  @IsEnum(ComplianceStatusDto)
  status?: ComplianceStatusDto;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  interested_party?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  responsible_person_id?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  related_area?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  deadline?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  document_stipulating?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  date_of_document?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  valid_from?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  country?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  state?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  link?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  law_regulation_name?: string;
}
