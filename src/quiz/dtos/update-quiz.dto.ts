import {
  IsOptional,
  IsString,
  Length,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsBoolean,
  IsArray,
} from 'class-validator';

export class UpdateQuizDto {
  @IsOptional()
  @IsString()
  @Length(1, 200)
  title?: string;

  @IsOptional()
  @IsString()
  desc?: string;

  @IsOptional()
  @IsString()
  quiz_type_id?: string;

  @IsOptional()
  @IsString()
  quiz_type?: string;

  @IsOptional()
  @IsString()
  file_url?: string;

  @IsOptional()
  @IsNumber()
  duration?: Number;

  @IsOptional()
  @IsNumber()
  total_marks?: Number;


  @IsBoolean()
  is_Mandatory?: Boolean = true;

  @IsOptional()
  @IsNumber()
  no_of_questions?: Number;

  @IsNotEmpty()
  @IsString()
  reason?: string; 
}

export class AssignQuestionsDto {
  @IsNumber()
  quiz_id: number;

  @IsArray()
  question_ids: number[];
}