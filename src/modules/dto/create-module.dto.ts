import { IsString, IsNumber, IsArray, IsNotEmpty, MaxLength, IsIn } from 'class-validator';

export class CreateModuleDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title: string;

  @IsArray()
  @IsString({ each: true })
  @IsNotEmpty()
  skills: string[];

  @IsString()
  @IsNotEmpty()
  desc: string;

  @IsNumber()
  @IsNotEmpty()
  duration: number; // Duration in minutes

  @IsString()
  @IsNotEmpty()
  @IsIn(['Beginner', 'Intermediate', 'Advanced'])
  level: string;

  @IsNumber()
  @IsNotEmpty()
  domainId: number;
}

