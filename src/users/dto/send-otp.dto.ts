import { IsEmail, IsString, IsOptional, Matches, ValidateIf } from 'class-validator';

export class SendOtpDto {
  @IsOptional()
  @IsEmail({}, { message: 'Please provide a valid email address' })
  email?: string;

  @IsOptional()
  @ValidateIf(o => o.phone !== undefined && o.phone !== null && o.phone !== '')
  @IsString({ message: 'Phone number must be a string' })
  @Matches(/^\d{10}$/, { message: 'Phone number must be exactly 10 digits' })
  phone?: string;
}

