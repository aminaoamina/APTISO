import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { EvidenceKind, EvidenceTargetType } from '@prisma/client';
import { plainToInstance, Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';

/** Multipart fields are strings: a malformed list stays a string and fails validation (400). */
const parseJson = (value: unknown) => {
  if (typeof value !== 'string') return value;
  try { return JSON.parse(value) as unknown; } catch { return value; }
};

export class EvidenceTargetDto {
  @ApiProperty({ enum: EvidenceTargetType })
  @IsEnum(EvidenceTargetType)
  type!: EvidenceTargetType;

  @ApiProperty({ description: 'Clause number (e.g. "9.2"), SoA control row id or task id' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  id!: string;
}

/** Sent as multipart form fields next to the optional file; `links` is a JSON array. */
export class CreateEvidenceDto {
  @ApiProperty() @IsString() @IsNotEmpty() @MaxLength(200)
  title!: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(5000)
  description?: string;

  @ApiProperty({ enum: EvidenceKind }) @IsEnum(EvidenceKind)
  kind!: EvidenceKind;

  @ApiPropertyOptional({ description: 'Required for a link' })
  @ValidateIf((o: CreateEvidenceDto) => o.kind === EvidenceKind.LINK)
  @IsUrl({ require_protocol: true })
  @MaxLength(1000)
  url?: string;

  @ApiProperty({ description: 'When the evidence was produced (YYYY-MM-DD)' }) @IsDateString()
  collected_on!: string;

  @ApiPropertyOptional({ description: 'When it stops being valid, e.g. a yearly pentest report' })
  @IsOptional() @IsDateString()
  valid_until?: string;

  @ApiProperty({ type: [EvidenceTargetDto] })
  @Transform(({ value }: { value: unknown }) => {
    const parsed = parseJson(value);
    return Array.isArray(parsed) ? plainToInstance(EvidenceTargetDto, parsed) : parsed;
  })
  @IsArray() @ArrayMaxSize(50) @ValidateNested({ each: true })
  links!: EvidenceTargetDto[];
}

export class UpdateEvidenceDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @IsNotEmpty() @MaxLength(200)
  title?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(5000)
  description?: string;

  @ApiPropertyOptional() @IsOptional() @IsDateString()
  collected_on?: string;

  @ApiPropertyOptional({ nullable: true, description: 'null removes the expiry date' })
  @IsOptional() @IsDateString()
  valid_until?: string | null;
}

export class WithdrawEvidenceDto {
  @ApiProperty({ description: 'Why the evidence is withdrawn (kept in the record)' })
  @IsString() @IsNotEmpty() @MaxLength(500)
  reason!: string;
}

export class ListEvidenceQuery {
  @ApiPropertyOptional({ enum: EvidenceTargetType }) @IsOptional() @IsEnum(EvidenceTargetType)
  target_type?: EvidenceTargetType;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(64)
  target_id?: string;
}
