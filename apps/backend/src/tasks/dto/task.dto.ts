import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TaskType } from '@prisma/client';
import { IsDateString, IsEnum, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class AssignTaskDto {
  @ApiProperty({ description: 'User ID of the person being assigned' })
  @IsUUID()
  assigned_to!: string;

  @ApiProperty({ enum: TaskType })
  @IsEnum(TaskType)
  type!: TaskType;

  @ApiPropertyOptional({ description: 'Instructions for the assignee' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;

  @ApiPropertyOptional({ description: 'Deadline (defaults to the deadline of the step document)' })
  @IsOptional()
  @IsDateString()
  deadline?: string;
}

export class UpdateTaskDto {
  @ApiPropertyOptional({ description: 'New assignee' })
  @IsOptional()
  @IsUUID()
  assigned_to?: string;

  @ApiPropertyOptional({ description: 'New deadline, or null to remove it', nullable: true })
  @IsOptional()
  @IsDateString()
  deadline?: string | null;
}

export class CompleteTaskDto {
  @ApiPropertyOptional({ description: 'What was done (kept as a record)' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}
