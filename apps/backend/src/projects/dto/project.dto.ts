import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsDateString,
  IsUUID,
  IsObject,
  MinLength,
  MaxLength,
  IsArray,
  ArrayMinSize,
  ArrayMaxSize,
  ValidateNested,
  IsUrl,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ProjectStatus } from '@prisma/client';

export class CreateProjectDto {
  @ApiProperty({ example: 'ISO 27001 Implementation' })
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(150)
  name: string;

  @ApiPropertyOptional({ example: 'Full ISO 27001 certification project' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({ enum: ProjectStatus, example: ProjectStatus.PLANNING })
  @IsOptional()
  @IsEnum(ProjectStatus)
  status?: ProjectStatus;

  @ApiProperty({ example: '2026-01-15' })
  @IsDateString()
  @IsNotEmpty()
  start_date: string;

  @ApiProperty({ example: '2026-07-15' })
  @IsDateString()
  @IsNotEmpty()
  target_date: string;

  @ApiProperty({ description: 'Compliance framework to base the project on' })
  @IsUUID()
  @IsNotEmpty()
  framework_id: string;
}

export class UpdateProjectDto {
  @ApiPropertyOptional({ example: 'Updated Project Name' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(150)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({ enum: ProjectStatus })
  @IsOptional()
  @IsEnum(ProjectStatus)
  status?: ProjectStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  start_date?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  target_date?: string;
}

export class UpdatePhaseDto {
  @ApiProperty({ enum: ['NOT_STARTED', 'IN_PROGRESS', 'COMPLETED'] })
  @IsEnum(['NOT_STARTED', 'IN_PROGRESS', 'COMPLETED'] as const)
  @IsNotEmpty()
  status: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED';
}

export class UpdateStepCompletionDataDto {
  @ApiProperty({ description: 'Completion data JSON — gate answer + question responses' })
  @IsObject()
  completion_data!: Record<string, unknown>;
}

export class UpdateStepMetadataDto {
  @ApiPropertyOptional({ description: 'Step metadata — clause, workload, deadline, etc.' })
  @IsOptional()
  @IsObject()
  metadata_json?: Record<string, unknown>;
}

export class AwarenessMaterialDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(300)
  title!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUrl({ require_protocol: true })
  @MaxLength(1000)
  url?: string;
}

export class SendAwarenessDto {
  @ApiProperty({ type: [AwarenessMaterialDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => AwarenessMaterialDto)
  materials!: AwarenessMaterialDto[];

  @ApiProperty({ type: [String], description: 'Project members who receive the materials' })
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('all', { each: true })
  user_ids!: string[];
}

export class TrainingRowDto {
  @ApiProperty({ description: 'Project member who needs the training' })
  @IsUUID()
  user_id!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  skills!: string;

  @ApiPropertyOptional({ description: 'Concrete training or course' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  training?: string;
}

export class ConfirmTrainingDto {
  @ApiProperty({ type: [TrainingRowDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => TrainingRowDto)
  rows!: TrainingRowDto[];
}
