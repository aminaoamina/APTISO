import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateBy,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export enum AssetCategoryDto {
  INFRASTRUCTURE = 'INFRASTRUCTURE',
  IT_COMMUNICATION = 'IT_COMMUNICATION',
  SOFTWARE_DATABASE = 'SOFTWARE_DATABASE',
  DOCUMENTS_DATA = 'DOCUMENTS_DATA',
  HUMAN_RESOURCES = 'HUMAN_RESOURCES',
  THIRD_PARTY = 'THIRD_PARTY',
}

export enum ThreatCategoryDto {
  FORCE_MAJEURE = 'FORCE_MAJEURE',
  INTERNAL_OVERSIGHT = 'INTERNAL_OVERSIGHT',
  UNINTENTIONAL_MISTAKE = 'UNINTENTIONAL_MISTAKE',
  MALICIOUS_INTENT = 'MALICIOUS_INTENT',
  TECHNICAL_ERROR = 'TECHNICAL_ERROR',
}

export enum TreatmentOptionDto {
  DECREASE = 'DECREASE',
  TRANSFER = 'TRANSFER',
  AVOID = 'AVOID',
  ACCEPT = 'ACCEPT',
}

export const IsRecordOfStringArrays = () =>
  ValidateBy({
    name: 'isRecordOfStringArrays',
    validator: {
      validate: (value: unknown): boolean => {
        if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
        return Object.values(value).every(v => Array.isArray(v) && v.every(item => typeof item === 'string'));
      },
      defaultMessage: () => 'each property must be an array of strings',
    },
  });

export class CustomAssetDto {
  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  @MaxLength(300)
  name!: string;

  @ApiProperty({ enum: AssetCategoryDto })
  @IsEnum(AssetCategoryDto)
  category!: AssetCategoryDto;
}

export class CustomVulnerabilityDto {
  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  @MaxLength(300)
  name!: string;

  @ApiProperty({ enum: AssetCategoryDto })
  @IsEnum(AssetCategoryDto)
  category!: AssetCategoryDto;

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  applicable_controls?: string[];
}

export class CustomThreatDto {
  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  @MaxLength(300)
  name!: string;

  @ApiProperty({ enum: ThreatCategoryDto })
  @IsEnum(ThreatCategoryDto)
  threat_category!: ThreatCategoryDto;

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  applicable_controls?: string[];
}

export class SaveAssetsDto {
  @ApiProperty({ type: [String], description: 'Catalog asset names to select' })
  @IsArray()
  @IsString({ each: true })
  assetNames!: string[];

  @ApiPropertyOptional({ type: [CustomAssetDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CustomAssetDto)
  customAssets?: CustomAssetDto[];
}

export class SaveVulnerabilitiesDto {
  @ApiProperty({ description: 'Map of asset id -> sorted vulnerability names for that asset' })
  @IsObject()
  @IsRecordOfStringArrays()
  vulnerabilitiesByAsset!: Record<string, string[]>;

  @ApiPropertyOptional({ type: [CustomVulnerabilityDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CustomVulnerabilityDto)
  customVulnerabilities?: CustomVulnerabilityDto[];
}

export class SaveThreatsDto {
  @ApiProperty({ description: 'Map of "assetId:vulnerabilityId" -> threat names for that combination' })
  @IsObject()
  @IsRecordOfStringArrays()
  threatsByAssetVulnerability!: Record<string, string[]>;

  @ApiPropertyOptional({ type: [CustomThreatDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CustomThreatDto)
  customThreats?: CustomThreatDto[];
}

const NULLABLE = (_: object, v: unknown) => v !== null;

export class UpdateRiskDto {
  @ApiPropertyOptional({ minimum: 0, maximum: 2, description: '0 = Low, 1 = Moderate, 2 = High' })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(2)
  impact?: number;

  @ApiPropertyOptional({ minimum: 0, maximum: 2, description: '0 = Low, 1 = Moderate, 2 = High' })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(2)
  likelihood?: number;

  @ApiPropertyOptional({ nullable: true, description: 'Project member; null to unassign' })
  @IsOptional()
  @ValidateIf(NULLABLE)
  @IsUUID()
  risk_owner_id?: string | null;

  @ApiPropertyOptional({ nullable: true, description: 'Project member; null to unassign' })
  @IsOptional()
  @ValidateIf(NULLABLE)
  @IsUUID()
  asset_owner_id?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  department?: string;

  @ApiPropertyOptional({ description: 'Security controls already in place for this risk' })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  existing_controls?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  comment?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  has_incidents?: boolean;

  @ApiPropertyOptional({ enum: TreatmentOptionDto })
  @IsOptional()
  @IsEnum(TreatmentOptionDto)
  treatment_option?: TreatmentOptionDto;

  @ApiPropertyOptional({ type: [String], description: 'Annex A control codes, e.g. "A.8.7"' })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(93)
  @IsString({ each: true })
  treatment_controls?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  treatment_description?: string;

  @ApiPropertyOptional({ minimum: 0, maximum: 2, nullable: true })
  @IsOptional()
  @ValidateIf(NULLABLE)
  @IsInt()
  @Min(0)
  @Max(2)
  residual_impact?: number | null;

  @ApiPropertyOptional({ minimum: 0, maximum: 2, nullable: true })
  @IsOptional()
  @ValidateIf(NULLABLE)
  @IsInt()
  @Min(0)
  @Max(2)
  residual_likelihood?: number | null;
}

export class ReviewRisksDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('all', { each: true })
  riskIds!: string[];

  @ApiPropertyOptional({ default: true, description: 'false un-marks the risks' })
  @IsOptional()
  @IsBoolean()
  reviewed?: boolean;
}

export enum RiskApprovalDto {
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

export class RiskApprovalRequestDto {
  @ApiProperty({ enum: RiskApprovalDto })
  @IsEnum(RiskApprovalDto)
  approval_decision!: RiskApprovalDto;

  @ApiPropertyOptional({ description: 'Required when rejecting: what the risk manager must improve' })
  @ValidateIf((o: RiskApprovalRequestDto) => o.approval_decision === RiskApprovalDto.REJECTED)
  @IsNotEmpty({ message: 'Explain why the residual risk is rejected' })
  @IsString()
  @MaxLength(2000)
  comment?: string;
}
