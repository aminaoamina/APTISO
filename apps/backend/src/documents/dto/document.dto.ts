import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsObject, IsOptional, IsString, IsUUID, MaxLength, Min } from 'class-validator';

export class CreateDocumentDto {
  @ApiProperty({ type: Object, example: { company_name: 'ACME Corporation' } })
  @IsObject()
  answers!: Record<string, string>;
}

export class UpdateDocumentContentDto {
  @ApiProperty({
    description: 'Structured Tiptap/ProseMirror document (a "doc" node)',
    type: Object,
  })
  @IsObject()
  content!: Record<string, unknown>;
}

export class UpdateDocumentAssignmentsDto {
  @ApiPropertyOptional({ description: 'User ID of the document owner' })
  @IsOptional()
  @IsUUID()
  owner_id?: string;

  @ApiPropertyOptional({ description: 'User ID of the reviewer' })
  @IsOptional()
  @IsUUID()
  reviewer_id?: string;

  @ApiPropertyOptional({ description: 'User ID of the approver' })
  @IsOptional()
  @IsUUID()
  approver_id?: string | null;

  @ApiPropertyOptional({ description: 'Update interval in months' })
  @IsOptional()
  @IsInt()
  @Min(1)
  update_interval?: number;

  @ApiPropertyOptional({ description: 'Document code, e.g. ISMS-POL-01' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  code?: string;

  @ApiPropertyOptional({ description: 'Confidentiality level, e.g. Internal' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  confidentiality?: string;
}

export class PublishDocumentDto {
  @ApiPropertyOptional({ description: 'What changed in this version' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

export class RequestChangesDto {
  @ApiProperty({ description: 'What must change before the document can be approved' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  comment!: string;
}

export class ExportDocxDto {
  @ApiPropertyOptional({ description: 'Unsaved editor content to export instead of the stored content', type: Object })
  @IsOptional()
  @IsObject()
  content?: Record<string, unknown>;
}
