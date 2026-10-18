import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { ActionStatus, FindingSource, IncidentSeverity, IncidentStatus } from '@prisma/client';

const NULLABLE = (_: object, v: unknown) => v !== null;

export class CreateNonconformityDto {
  @ApiProperty() @IsString() @IsNotEmpty() @MaxLength(300) title!: string;
  @ApiProperty() @IsString() @IsNotEmpty() @MaxLength(5000) description!: string;
  @ApiPropertyOptional({ enum: FindingSource }) @IsOptional() @IsEnum(FindingSource) source?: FindingSource;
  @ApiProperty({ example: '2026-10-01' }) @IsDateString() detected_on!: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() responsible_id?: string;
}

export class UpdateNonconformityDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @IsNotEmpty() @MaxLength(300) title?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @IsNotEmpty() @MaxLength(5000) description?: string;
  @ApiPropertyOptional({ enum: FindingSource }) @IsOptional() @IsEnum(FindingSource) source?: FindingSource;
  @ApiPropertyOptional() @IsOptional() @IsDateString() detected_on?: string;
  @ApiPropertyOptional({ nullable: true }) @IsOptional() @ValidateIf(NULLABLE) @IsUUID() responsible_id?: string | null;
  @ApiPropertyOptional({ description: 'Immediate correction (clause 10.2 a)' }) @IsOptional() @IsString() @MaxLength(5000) correction?: string;
  @ApiPropertyOptional({ description: 'Root cause analysis (clause 10.2 b)' }) @IsOptional() @IsString() @MaxLength(5000) root_cause?: string;
}

export class CreateActionDto {
  @ApiProperty() @IsString() @IsNotEmpty() @MaxLength(5000) description!: string;
  @ApiProperty() @IsUUID() responsible_id!: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() due_date?: string;
}

export class UpdateActionDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @IsNotEmpty() @MaxLength(5000) description?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() responsible_id?: string;
  @ApiPropertyOptional({ nullable: true }) @IsOptional() @ValidateIf(NULLABLE) @IsDateString() due_date?: string | null;
  @ApiPropertyOptional({ enum: ActionStatus }) @IsOptional() @IsEnum(ActionStatus) status?: ActionStatus;
}

export class ResolveNonconformityDto {
  @ApiProperty({ description: 'Review of the effectiveness of the corrective actions (clause 10.2 d)' })
  @IsString() @IsNotEmpty() @MaxLength(5000) effectiveness_review!: string;
}

export class NotRelevantDto {
  @ApiProperty() @IsString() @IsNotEmpty() @MaxLength(2000) reason!: string;
}

export class CreateIncidentDto {
  @ApiProperty() @IsString() @IsNotEmpty() @MaxLength(300) title!: string;
  @ApiProperty() @IsString() @IsNotEmpty() @MaxLength(5000) description!: string;
  @ApiProperty() @IsDateString() occurred_at!: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() responsible_id?: string;
  @ApiPropertyOptional({ enum: IncidentSeverity }) @IsOptional() @IsEnum(IncidentSeverity) severity?: IncidentSeverity;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() affects_confidentiality?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() affects_integrity?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() affects_availability?: boolean;
}

export class UpdateIncidentDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @IsNotEmpty() @MaxLength(300) title?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @IsNotEmpty() @MaxLength(5000) description?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() occurred_at?: string;
  @ApiPropertyOptional({ nullable: true }) @IsOptional() @ValidateIf(NULLABLE) @IsUUID() responsible_id?: string | null;
  @ApiPropertyOptional({ enum: IncidentSeverity }) @IsOptional() @IsEnum(IncidentSeverity) severity?: IncidentSeverity;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() affects_confidentiality?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() affects_integrity?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() affects_availability?: boolean;
  @ApiPropertyOptional({ description: 'Assessment (A.5.25): is this event an information security incident?' })
  @IsOptional() @IsBoolean() is_security_incident?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(5000) assessment?: string;
  @ApiPropertyOptional({ description: 'Response (A.5.26)' }) @IsOptional() @IsString() @MaxLength(5000) response?: string;
  @ApiPropertyOptional({ description: 'Lessons learned (A.5.27)' }) @IsOptional() @IsString() @MaxLength(5000) lessons_learned?: string;
  @ApiPropertyOptional({ description: 'Evidence collected (A.5.28)' }) @IsOptional() @IsString() @MaxLength(5000) evidence?: string;
  @ApiPropertyOptional({ enum: IncidentStatus }) @IsOptional() @IsEnum(IncidentStatus) status?: IncidentStatus;
}
