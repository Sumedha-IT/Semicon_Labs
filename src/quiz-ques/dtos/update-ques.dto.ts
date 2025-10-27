import { IsOptional, IsString, IsNumber, IsArray } from 'class-validator';

export class UpdateQuizQuestionDto {
  @IsOptional()
  @IsString()
  question?: string;

  @IsOptional()
  @IsString()
  image_url?: string;

  @IsOptional()
  @IsString()
  question_type?: string;

  @IsOptional()
  @IsNumber()
  marks?: number;

  @IsOptional()
  @IsNumber()
  order_in_quiz?: number;
}

export class  UnassignOptionsDto{

  @IsOptional()
  @IsNumber()
  question_id?: number;

  @IsOptional()
  @IsArray()
  option_ids?: number[];
}
