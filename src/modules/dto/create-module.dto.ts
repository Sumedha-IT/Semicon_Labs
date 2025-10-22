import {
  IsString,
  IsNumber,
  IsNotEmpty,
  MaxLength,
  IsIn,
  IsOptional,
} from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateModuleDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title: string;

  @IsOptional()
  @IsString()
  desc?: string;

  @IsOptional()
  @IsNumber()
  duration?: number; // Duration in minutes

  @IsOptional()
  @IsString()
  @Transform(({ value }) => {
    if (!value) return value;
    // Capitalize first letter: beginner -> Beginner
    return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
  })
  @IsIn(['Beginner', 'Intermediate', 'Advanced'])
  level?: string;
}
