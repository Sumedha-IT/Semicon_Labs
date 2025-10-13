import {
  IsString,
  IsNumber,
  IsArray,
  IsOptional,
  MaxLength,
  IsIn,
  Min,
  Max,
} from 'class-validator';

export class UpdateModuleDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  skills?: string[];

  @IsOptional()
  @IsString()
  desc?: string;

  @IsOptional()
  @IsNumber()
  duration?: number; // Duration in minutes

  @IsOptional()
  @IsString()
  @IsIn(['Beginner', 'Intermediate', 'Advanced'])
  level?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  threshold_score?: number; // Passing threshold score (0-100)

  // Note: Domain associations are updated via separate link/unlink endpoints
}
