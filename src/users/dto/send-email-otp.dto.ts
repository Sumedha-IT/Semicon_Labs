import { IsString, Length, Matches } from 'class-validator';

export class SendOtpDto {
  @IsString({ message: 'Please provide an email address or phone number' })
  contact: string; // Can be email or phone number
}

