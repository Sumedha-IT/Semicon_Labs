import { IsOptional, IsString, Length,  IsIn, IsNotEmpty } from 'class-validator';

export class UpdateTopicDto {
  @IsOptional()
  @IsString()
  @Length(1, 200)
  title?: string;

  @IsOptional()
  @IsString()
  desc?: string;

  @IsOptional()
  @IsString()
  @IsIn(['Beginner', 'Intermediate', 'Advanced'])
  level?: string;

  @IsNotEmpty()
  @IsString()
  reason: string; // Mandatory field for changelog
} 