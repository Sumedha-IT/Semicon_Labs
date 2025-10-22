import {
  IsString,
  IsNumber,
  IsOptional,
  MaxLength,
  IsIn,
  IsNotEmpty,
} from 'class-validator';
import { Transform } from 'class-transformer';

export class UpdateModuleDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

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

  @IsNotEmpty()
  @IsString()
  reason: string; // Mandatory field for changelog

  // Note: Domain associations are updated via separate link/unlink endpoints
}
