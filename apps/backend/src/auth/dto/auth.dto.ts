import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsIn,
  IsUUID,
  IsString,
  ValidateNested,
  MinLength,
  MaxLength,
} from 'class-validator';

export class DeleteOrganizationChoiceDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  organization_id: string;

  @ApiProperty({ enum: ['TRANSFER', 'DELETE'] })
  @IsIn(['TRANSFER', 'DELETE'])
  action: 'TRANSFER' | 'DELETE';

  @ApiProperty({ required: false, format: 'uuid' })
  @IsOptional()
  @IsUUID()
  transfer_to_user_id?: string;
}

export class DeleteAccountDto {
  @ApiProperty({ type: [DeleteOrganizationChoiceDto] })
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => DeleteOrganizationChoiceDto)
  organizations?: DeleteOrganizationChoiceDto[];
}

export class RegisterDto {
  @ApiProperty({ example: 'John' })
  @IsString()
  @IsNotEmpty()
  @MinLength(2, { message: 'First name must be at least 2 characters' })
  first_name: string;

  @ApiProperty({ example: 'Doe' })
  @IsString()
  @IsNotEmpty()
  @MinLength(2, { message: 'Last name must be at least 2 characters' })
  last_name: string;

  @ApiProperty({ example: 'john.doe@example.com' })
  @IsEmail({}, { message: 'Invalid email format' })
  @IsNotEmpty()
  email: string;

  @ApiProperty({ example: 'SecurePassword123!', minLength: 8 })
  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters' })
  password: string;
}

export class LoginDto {
  @ApiProperty({ example: 'john.doe@example.com' })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({ example: 'SecurePassword123!' })
  @IsString()
  @IsNotEmpty()
  password: string;
}

export class PasswordResetRequestDto {
  @ApiProperty({ example: 'john.doe@example.com' })
  @IsEmail()
  @IsNotEmpty()
  email: string;
}

export class VerifyResetCodeDto {
  @ApiProperty({ example: 'john.doe@example.com' })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({ example: '12345', minLength: 5, maxLength: 5 })
  @IsString()
  @IsNotEmpty()
  @MinLength(5, { message: 'Reset code must be 5 digits' })
  @MaxLength(5, { message: 'Reset code must be 5 digits' })
  reset_code: string;
}

export class PasswordResetDto {
  @ApiProperty({ example: 'john.doe@example.com' })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({ example: '12345', minLength: 5, maxLength: 5 })
  @IsString()
  @IsNotEmpty()
  @MinLength(5, { message: 'Reset code must be 5 digits' })
  @MaxLength(5, { message: 'Reset code must be 5 digits' })
  reset_code: string;

  @ApiProperty({ minLength: 8 })
  @IsString()
  @MinLength(8)
  new_password: string;
}

export class ResendResetCodeDto {
  @ApiProperty({ example: 'john.doe@example.com' })
  @IsEmail()
  @IsNotEmpty()
  email: string;
}

export class ResendVerificationDto {
  @ApiProperty({ example: 'john.doe@example.com' })
  @IsEmail()
  @IsNotEmpty()
  email: string;
}

export class UpdateProfileDto {
  @ApiProperty({ example: 'John', required: false })
  @IsOptional()
  @IsString()
  @MinLength(2, { message: 'First name must be at least 2 characters' })
  first_name?: string;

  @ApiProperty({ example: 'Doe', required: false })
  @IsOptional()
  @IsString()
  @MinLength(2, { message: 'Last name must be at least 2 characters' })
  last_name?: string;

  @ApiProperty({ example: 'john.doe@example.com', required: false })
  @IsOptional()
  @IsEmail({}, { message: 'Invalid email format' })
  email?: string;

  @ApiProperty({ example: 'Compliance Manager', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(150, { message: 'Job title must be 150 characters or less' })
  job_title?: string;

  @ApiProperty({ example: 'UTC', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(50, { message: 'Timezone must be 50 characters or less' })
  timezone?: string;

  @ApiProperty({ example: 'ISO 27001 compliance specialist', required: false })
  @IsOptional()
  @IsString()
  bio?: string;
}

export class ChangePasswordDto {
  @ApiProperty({ example: 'CurrentPassword123!' })
  @IsString()
  @IsNotEmpty()
  current_password: string;

  @ApiProperty({ example: 'NewPassword123!', minLength: 8 })
  @IsString()
  @MinLength(8, { message: 'New password must be at least 8 characters' })
  new_password: string;
}
