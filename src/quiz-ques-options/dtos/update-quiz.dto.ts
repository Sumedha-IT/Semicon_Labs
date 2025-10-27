import { IsOptional, IsString, IsBoolean, IsNotEmpty } from 'class-validator';

export class UpdateQuizOptionDto {
  @IsString()
  option_text: string;

  @IsBoolean()
  is_correct: boolean;

  @IsNotEmpty()
  @IsString()
  reason: string;
}

export class ReasonDto{
  @IsNotEmpty()
  @IsString()
  reason: string;
}