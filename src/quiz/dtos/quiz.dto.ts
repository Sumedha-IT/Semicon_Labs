import { IsOptional, IsString, Length, IsIn, IsNumber, IsBoolean } from 'class-validator';

export class CreateQuizDto {
  @IsString()
  @Length(1, 200)
  title: string;

  @IsOptional()
  @IsString()
  desc?: string;

    @IsString()
    quiz_type_id: string
  
    @IsString()
    // @IsIn(['module', 'topic'])
    quiz_type: string;
  
    @IsOptional()
    @IsString()
    file_url: string;
  
    @IsOptional()
    // @IsString()
    duration: Number;
  
    @IsNumber()
    total_marks: Number;
  
    @IsBoolean()
    is_Mandatory: Boolean = true;
  
    @IsNumber()
    no_of_questions: Number;
} 