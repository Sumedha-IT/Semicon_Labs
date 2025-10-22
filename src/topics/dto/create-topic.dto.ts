import { IsOptional, IsString, Length, IsIn } from 'class-validator';

export class CreateTopicDto {
  @IsString()
  @Length(1, 200)
  title: string;

  @IsOptional()
  @IsString()
  desc?: string;

  @IsOptional()
  @IsString()
  @IsIn(['Beginner', 'Intermediate', 'Advanced'])
  level?: string;
} 