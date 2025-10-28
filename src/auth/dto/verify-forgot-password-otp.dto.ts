import { IsEmail, IsString, Length } from 'class-validator';

export class VerifyForgotPasswordOtpDto {
  @IsEmail({}, { message: 'Email must be valid' })
  email: string;

  @IsString()
  @Length(6, 6, { message: 'OTP must be 6 digits' })
  otp: string;
}

