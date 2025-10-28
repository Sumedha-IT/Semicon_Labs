import { IsEmail, IsString, IsNotEmpty, Length } from 'class-validator';

export class VerifyLoginOtpDto {
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  @Length(6, 6)
  otp: string;
}