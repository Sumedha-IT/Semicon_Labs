import { Transform, Type } from 'class-transformer';
import { IsOptional, IsString, Length, IsIn, IsNumber, IsBoolean, IsArray, ValidateNested, ArrayNotEmpty } from 'class-validator';

export class CreateQuizQuestionDto {
  @IsString()
  @Length(1, 200)
  question: string;

    @IsOptional()
    @IsString()
    image_url?: string;

    @IsOptional()
    @IsString()
    question_type?: string;
  
  
    @IsNumber()
    marks: number; // ex: one question - 5marks
  
  
    @IsNumber()
    order_in_quiz: number;
} 

export class AssignQuestionsDto {

  // note: here we need order_in_quiz cause while creating its have duplicates
  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  quiz_id?: number;

  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  order_in_quiz?: number;

  
  @IsArray()
  @Type(() => Number)
  question_ids: number[];
}