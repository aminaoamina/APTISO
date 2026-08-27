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
} from 'class-validator';
import { ProjectStatus, TaskType } from '@prisma/client';

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

export class AssignTaskDto {
  @ApiProperty({ description: 'User ID of the person being assigned' })
  @IsUUID()
  @IsNotEmpty()
  assigned_to!: string;

  @ApiProperty({ enum: TaskType, description: 'Type of assignment' })
  @IsEnum(TaskType)
  @IsNotEmpty()
  type!: TaskType;

  @ApiPropertyOptional({ description: 'Optional notes for the assignment' })
  @IsOptional()
  @IsString()
  notes?: string;
}
