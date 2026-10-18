import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsObject, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class SuggestDto {
  @ApiProperty({ example: 'ISMS-SCOPE' }) @IsString() @MaxLength(50) templateCode!: string;
  @ApiProperty({ example: 'departments' }) @IsString() @MaxLength(80) questionKey!: string;
  @ApiPropertyOptional({ description: 'The answers currently typed in the wizard (question key → value)' })
  @IsOptional() @IsObject() answers?: Record<string, string>;
}

export class ImproveDto {
  @ApiProperty() @IsUUID() documentId!: string;
  @ApiProperty() @IsString() @MinLength(1) @MaxLength(4000) text!: string;
  @ApiProperty({ description: '"clearer", "formal", "shorter", or a custom instruction' }) @IsString() @MinLength(1) @MaxLength(300) instruction!: string;
}

export class DecisionDto {
  @ApiProperty() @IsUUID() runId!: string;
  @ApiProperty({ enum: ['ACCEPTED', 'DISMISSED'] }) @IsIn(['ACCEPTED', 'DISMISSED']) outcome!: 'ACCEPTED' | 'DISMISSED';
}

export class ChatDto {
  @ApiProperty() @IsString() @MinLength(1) @MaxLength(2000) message!: string;
  @ApiPropertyOptional({ description: 'The conversation to continue; a new one is started without it' })
  @IsOptional() @IsUUID() conversation_id?: string;
}
