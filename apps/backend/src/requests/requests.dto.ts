import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ResourceRequestKind } from '@prisma/client';
import { IsEnum, IsIn, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateRequestDto {
  @ApiProperty({ enum: ResourceRequestKind })
  @IsEnum(ResourceRequestKind)
  kind!: ResourceRequestKind;

  @ApiProperty({ description: 'What is needed and why' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  description!: string;
}

export class DecideRequestDto {
  @ApiProperty({ enum: ['APPROVED', 'REJECTED'] })
  @IsIn(['APPROVED', 'REJECTED'])
  decision!: 'APPROVED' | 'REJECTED';

  @ApiPropertyOptional({ description: 'Comment for the requester; required when rejecting' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  comment?: string;
}
