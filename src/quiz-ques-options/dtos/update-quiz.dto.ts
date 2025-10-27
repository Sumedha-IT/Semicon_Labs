import { IsOptional, IsString, IsBoolean } from 'class-validator';

export class UpdateQuizOptionDto {
  @IsString()
  option_text: string;

  @IsBoolean()
  is_correct: boolean;
}
