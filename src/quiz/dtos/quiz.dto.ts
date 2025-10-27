import { IsOptional, IsString, Length, IsIn, IsNumber, IsBoolean, IsInt } from 'class-validator';

export class CreateQuizDto {
  @IsString()
  @Length(1, 200)
  title: string;

  @IsOptional()
  @IsString()
  desc?: string;

    @IsOptional()
    @IsString()
    quiz_type_id: string
  
    @IsOptional()
    @IsString()
    // @IsIn(['module', 'topic'])
    quiz_type: string;
  
    @IsOptional()
    @IsString()
    file_url: string;
  
    @IsOptional()
    // @IsString()
    duration: number;
  
    @IsNumber()
    total_marks: number;

    @IsInt()
    @IsOptional()
    module_id: number;
  
    @IsBoolean()
    is_Mandatory: Boolean = true;
  
    @IsNumber()
    no_of_questions: number;
} 