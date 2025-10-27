import { IsArray, IsBoolean, IsNumber, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class OptionDto {
  @IsString()
  option_text: string;

  @IsOptional()
  @IsBoolean()
  is_correct?: boolean;
}

export class AssignOptionsDto {
  @IsNumber()
  quiz_question_id: number;

  @IsArray()
  option_ids: number[];
}
