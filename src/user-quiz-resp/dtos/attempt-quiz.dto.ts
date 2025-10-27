import { IsNumber, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class UserAnswerDto {
  @IsNumber()
  question_id: number;

  @IsNumber()
  selected_option_id: number;
}

export class AttemptQuizDto {
  @IsNumber()
  user_id: number;

  @IsNumber()
  quiz_id: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UserAnswerDto)
  answers: UserAnswerDto[];
}
