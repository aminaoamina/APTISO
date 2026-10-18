import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsOptional, IsString, MaxLength, ValidateIf } from 'class-validator';
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
