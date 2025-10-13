import {
  IsString,
  IsNumber,
  IsArray,
  IsNotEmpty,
  MaxLength,
  IsIn,
  ArrayMinSize,
  IsInt,
  IsPositive,
  Min,
  Max,
} from 'class-validator';

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
  @Min(0)
  @Max(100)
  threshold_score?: number; // Passing threshold score (0-100), defaults to 70

  @IsArray()
  @ArrayMinSize(1, { message: 'At least one domain must be provided' })
  @IsInt({ each: true, message: 'Each domain ID must be an integer' })
  @IsPositive({ each: true, message: 'Each domain ID must be positive' })
  domainIds: number[];
}
