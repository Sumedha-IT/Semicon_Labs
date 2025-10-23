import {
  IsOptional,
  IsString,
  IsInt,
  IsPositive,
  IsIn,
} from 'class-validator';
import { Type } from 'class-transformer';
import { BaseQueryDto } from '../../common/dto/base-query.dto';

export class QuizQueryDto extends BaseQueryDto {
  @IsOptional()
  @IsString()
//   @IsIn(['Beginner', 'Intermediate', 'Advanced'])
  title?: string;

  @IsOptional()
  @IsInt()
  quiz_type?: string;

  @IsOptional()
  @IsString()
  @IsIn(['title', 'quiz_type', 'createdAt', 'updatedAt'])
  sortBy?: string = 'title';
}

