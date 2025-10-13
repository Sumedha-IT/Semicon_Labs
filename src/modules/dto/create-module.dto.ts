import { IsString, IsNumber, IsArray, IsNotEmpty, MaxLength, IsIn, ArrayMinSize, IsInt, IsPositive } from 'class-validator';

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

  @IsArray()
  @ArrayMinSize(1, { message: 'At least one domain must be provided' })
  @IsInt({ each: true, message: 'Each domain ID must be an integer' })
  @IsPositive({ each: true, message: 'Each domain ID must be positive' })
  domainIds: number[];
}

