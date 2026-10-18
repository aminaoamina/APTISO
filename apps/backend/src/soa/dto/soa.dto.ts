import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateBy,
  ValidateIf,
} from 'class-validator';

const NULLABLE = (_: object, v: unknown) => v !== null;

export enum ControlStatusDto {
  IMPLEMENTED = 'IMPLEMENTED',
  UNDERWAY = 'UNDERWAY',
  PLANNED = 'PLANNED',
  REVIEW_NEEDED = 'REVIEW_NEEDED',
}

export enum DecisionDto {
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

const IsRecordOfBooleans = () =>
  ValidateBy({
    name: 'isRecordOfBooleans',
    validator: {
      validate: (v: unknown) =>
        typeof v === 'object' && v !== null && !Array.isArray(v) && Object.values(v).every(x => typeof x === 'boolean'),
      defaultMessage: () => 'answers must map each question to true or false',
    },
  });

export class SaveSetupDto {
  @ApiProperty({ description: 'Question key -> yes (true) / no (false)' })
  @IsObject()
  @IsRecordOfBooleans()
  answers!: Record<string, boolean>;
}

export class ApplySuggestionsDto {
  @ApiPropertyOptional({ description: 'Also overwrite controls you edited yourself', default: false })
  @IsOptional()
  @IsBoolean()
  overwrite?: boolean;
}

export class UpdateSoaControlDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  applicable?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  justification?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  implementation_method?: string;

  @ApiPropertyOptional({ enum: ControlStatusDto, nullable: true })
  @IsOptional()
  @ValidateIf(NULLABLE)
  @IsEnum(ControlStatusDto)
  status?: ControlStatusDto | null;

  @ApiPropertyOptional({ nullable: true, description: 'Project member responsible for implementing the control' })
  @IsOptional()
  @ValidateIf(NULLABLE)
  @IsUUID()
  responsible_id?: string | null;

  @ApiPropertyOptional({ nullable: true, example: '2026-12-31' })
  @IsOptional()
  @ValidateIf(NULLABLE)
  @IsDateString()
  deadline?: string | null;

  @ApiPropertyOptional({ description: 'Resources needed (budget, people, technology); empty when none' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  resources?: string;
}

export class DecisionRequestDto {
  @ApiProperty({ enum: DecisionDto })
  @IsEnum(DecisionDto)
  decision!: DecisionDto;

  @ApiPropertyOptional({ description: 'Required when rejecting' })
  @ValidateIf((o: DecisionRequestDto) => o.decision === DecisionDto.REJECTED)
  @IsNotEmpty({ message: 'Explain why you reject' })
  @IsString()
  @MaxLength(2000)
  comment?: string;
}

export class OwnerApprovalRequestDto extends DecisionRequestDto {
  @ApiPropertyOptional({ description: 'Project lead only: the risk owner on whose behalf the decision is made' })
  @IsOptional()
  @IsUUID()
  on_behalf_of?: string;
}
