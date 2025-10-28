import { IsEmail, IsString, MinLength, IsOptional, IsBoolean } from 'class-validator';

export class UnifiedLoginDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(6)
  password: string;

  @IsOptional()
  @IsBoolean()
  useOtp?: boolean;
}


