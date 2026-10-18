import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import {
  ActionStatus,
  AuditResult,
  ObjectiveType,
  ReviewDecisionType,
  ReviewFrequency,
  TrainingStatus,
} from '@prisma/client';

const NULLABLE = (_: object, v: unknown) => v !== null;

// ─── Trainings ─────────────────────────────────────────────────

export class CreateTrainingDto {
  @ApiProperty() @IsString() @IsNotEmpty() @MaxLength(300) title!: string;
  @ApiProperty({ description: 'Knowledge and skills to acquire' }) @IsString() @IsNotEmpty() @MaxLength(3000) skills!: string;
  @ApiProperty({ type: [String] }) @IsArray() @ArrayMinSize(1) @IsUUID('all', { each: true }) participant_ids!: string[];
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(200) method?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(200) provider?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() planned_date?: string;
}

export class UpdateTrainingDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @IsNotEmpty() @MaxLength(300) title?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @IsNotEmpty() @MaxLength(3000) skills?: string;
  @ApiPropertyOptional({ type: [String] }) @IsOptional() @IsArray() @ArrayMinSize(1) @IsUUID('all', { each: true }) participant_ids?: string[];
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(200) method?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(200) provider?: string;
  @ApiPropertyOptional({ nullable: true }) @IsOptional() @ValidateIf(NULLABLE) @IsDateString() planned_date?: string | null;
  @ApiPropertyOptional({ nullable: true }) @IsOptional() @ValidateIf(NULLABLE) @IsDateString() performed_date?: string | null;
  @ApiPropertyOptional({ description: 'Attendance list, certificates (competence evidence, clause 7.2 d)' }) @IsOptional() @IsString() @MaxLength(3000) evidence?: string;
  @ApiPropertyOptional({ description: 'Evaluation of the effectiveness of the training (clause 7.2 c)' }) @IsOptional() @IsString() @MaxLength(3000) effectiveness?: string;
  @ApiPropertyOptional({ enum: TrainingStatus }) @IsOptional() @IsEnum(TrainingStatus) status?: TrainingStatus;
}

// ─── Security objectives ───────────────────────────────────────

export class ObjectiveDto {
  @ApiProperty() @IsString() @IsNotEmpty() @MaxLength(1000) title!: string;
  @ApiPropertyOptional({ enum: ObjectiveType }) @IsOptional() @IsEnum(ObjectiveType) type?: ObjectiveType;
  @ApiPropertyOptional({ description: 'What will be done (clause 6.2)' }) @IsOptional() @IsString() @MaxLength(3000) action_plan?: string;
  @ApiPropertyOptional({ description: 'Resources required (clause 6.2)' }) @IsOptional() @IsString() @MaxLength(2000) resources?: string;
  @ApiPropertyOptional({ nullable: true }) @IsOptional() @ValidateIf(NULLABLE) @IsUUID() responsible_id?: string | null;
  @ApiPropertyOptional({ nullable: true, description: 'When it will be completed (clause 6.2)' }) @IsOptional() @ValidateIf(NULLABLE) @IsDateString() due_date?: string | null;
  @ApiPropertyOptional({ description: 'How the results will be evaluated (clause 6.2)' }) @IsOptional() @IsString() @MaxLength(2000) measurement?: string;
  @ApiPropertyOptional({ enum: ReviewFrequency }) @IsOptional() @IsEnum(ReviewFrequency) frequency?: ReviewFrequency;
}

export class UpdateObjectiveDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @IsNotEmpty() @MaxLength(1000) title?: string;
  @ApiPropertyOptional({ enum: ObjectiveType }) @IsOptional() @IsEnum(ObjectiveType) type?: ObjectiveType;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(3000) action_plan?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(2000) resources?: string;
  @ApiPropertyOptional({ nullable: true }) @IsOptional() @ValidateIf(NULLABLE) @IsUUID() responsible_id?: string | null;
  @ApiPropertyOptional({ nullable: true }) @IsOptional() @ValidateIf(NULLABLE) @IsDateString() due_date?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(2000) measurement?: string;
  @ApiPropertyOptional({ enum: ReviewFrequency }) @IsOptional() @IsEnum(ReviewFrequency) frequency?: ReviewFrequency;
}

export class MeasurementDto {
  @ApiProperty() @IsDateString() measured_on!: string;
  @ApiProperty({ description: 'Measured result, e.g. "12 incidents (-14%)"' }) @IsString() @IsNotEmpty() @MaxLength(2000) result!: string;
  @ApiProperty() @IsBoolean() achieved!: boolean;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(2000) comment?: string;
}

// ─── Internal audit ────────────────────────────────────────────

export class CreateAuditDto {
  @ApiProperty() @IsString() @IsNotEmpty() @MaxLength(300) title!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(3000) scope?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(3000) criteria?: string;
  @ApiProperty() @IsDateString() start_date!: string;
  @ApiProperty() @IsDateString() end_date!: string;
  @ApiProperty() @IsUUID() lead_auditor_id!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(2000) auditees?: string;
}

export class UpdateAuditDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @IsNotEmpty() @MaxLength(300) title?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(3000) scope?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(3000) criteria?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() start_date?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() end_date?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() lead_auditor_id?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(2000) auditees?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(5000) conclusion?: string;
}

export class UpdateAuditItemDto {
  @ApiPropertyOptional({ enum: AuditResult, nullable: true }) @IsOptional() @ValidateIf(NULLABLE) @IsEnum(AuditResult) result?: AuditResult | null;
  @ApiPropertyOptional({ description: 'Audit evidence: documents seen, records sampled, people interviewed' }) @IsOptional() @IsString() @MaxLength(5000) evidence?: string;
}

export class AuditReportDto {
  @ApiProperty({ description: 'Audit conclusion (clause 9.2.2)' }) @IsString() @IsNotEmpty() @MaxLength(5000) conclusion!: string;
}

// ─── Management review ─────────────────────────────────────────

export class ReviewItemDto {
  @ApiProperty() @IsString() @IsNotEmpty() @MaxLength(20) key!: string;
  @ApiProperty() @IsString() @IsNotEmpty() @MaxLength(300) title!: string;
  @ApiPropertyOptional({ description: 'Materials to be reviewed' }) @IsOptional() @IsString() @MaxLength(2000) materials?: string;
}

export class ReviewSetupDto {
  @ApiProperty({ enum: ReviewFrequency }) @IsEnum(ReviewFrequency) frequency!: ReviewFrequency;
  @ApiPropertyOptional({ nullable: true }) @IsOptional() @ValidateIf(NULLABLE) @IsDateString() next_review_date?: string | null;
  @ApiProperty({ type: [String] }) @IsArray() @IsUUID('all', { each: true }) reviewer_ids!: string[];
  @ApiProperty({ type: [ReviewItemDto] })
  @IsArray() @ArrayMaxSize(40) @ValidateNested({ each: true }) @Type(() => ReviewItemDto)
  items!: ReviewItemDto[];
}

export class CreateReviewDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(300) title?: string;
  @ApiProperty() @IsDateString() review_date!: string;
  @ApiProperty({ type: [String] }) @IsArray() @ArrayMinSize(1) @IsUUID('all', { each: true }) participant_ids!: string[];
}

export class UpdateReviewDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(300) title?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() review_date?: string;
  @ApiPropertyOptional({ type: [String] }) @IsOptional() @IsArray() @ArrayMinSize(1) @IsUUID('all', { each: true }) participant_ids?: string[];
  @ApiPropertyOptional({ description: 'Overall conclusions of top management' }) @IsOptional() @IsString() @MaxLength(5000) conclusions?: string;
}

export class UpdateReviewInputDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(5000) notes?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() discussed?: boolean;
}

export class DecisionDto {
  @ApiPropertyOptional({ enum: ReviewDecisionType }) @IsOptional() @IsEnum(ReviewDecisionType) type?: ReviewDecisionType;
  @ApiProperty() @IsString() @IsNotEmpty() @MaxLength(3000) description!: string;
  @ApiPropertyOptional({ nullable: true }) @IsOptional() @ValidateIf(NULLABLE) @IsUUID() responsible_id?: string | null;
  @ApiPropertyOptional({ nullable: true }) @IsOptional() @ValidateIf(NULLABLE) @IsDateString() due_date?: string | null;
}

export class UpdateDecisionDto {
  @ApiPropertyOptional({ enum: ReviewDecisionType }) @IsOptional() @IsEnum(ReviewDecisionType) type?: ReviewDecisionType;
  @ApiPropertyOptional() @IsOptional() @IsString() @IsNotEmpty() @MaxLength(3000) description?: string;
  @ApiPropertyOptional({ nullable: true }) @IsOptional() @ValidateIf(NULLABLE) @IsUUID() responsible_id?: string | null;
  @ApiPropertyOptional({ nullable: true }) @IsOptional() @ValidateIf(NULLABLE) @IsDateString() due_date?: string | null;
  @ApiPropertyOptional({ enum: ActionStatus }) @IsOptional() @IsEnum(ActionStatus) status?: ActionStatus;
}
