import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsOptional, IsString, IsUUID, MaxLength, ValidateIf } from 'class-validator';
import { ReviewFrequency } from '@prisma/client';

const NULLABLE = (_: object, v: unknown) => v !== null;

export class UpdateMaintenanceDto {
  @ApiPropertyOptional({ nullable: true, description: 'Date the certificate was issued' })
  @IsOptional() @ValidateIf(NULLABLE) @IsDateString()
  certification_date?: string | null;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(200)
  certification_body?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100)
  certificate_number?: string;

  @ApiPropertyOptional({ enum: ReviewFrequency }) @IsOptional() @IsEnum(ReviewFrequency)
  incident_review_frequency?: ReviewFrequency;

  @ApiPropertyOptional({ enum: ReviewFrequency }) @IsOptional() @IsEnum(ReviewFrequency)
  training_review_frequency?: ReviewFrequency;
}

export class UpdateAuditProgramDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(3000) objectives?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(3000) criteria?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(3000) methods?: string;
}

export class CreateProgramAuditDto {
  @ApiProperty({ description: 'Any date in the planned month' }) @IsDateString() planned_month!: string;
  @ApiProperty() @IsUUID() auditor_id!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(3000) scope?: string;
}

export class UpdateProgramAuditDto {
  @ApiPropertyOptional() @IsOptional() @IsDateString() planned_month?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() auditor_id?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(3000) scope?: string;
}
