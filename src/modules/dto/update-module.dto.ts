import {
  IsString,
  IsNumber,
  IsOptional,
  MaxLength,
  IsIn,
  IsNotEmpty,
} from 'class-validator';

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
  @IsIn(['Beginner', 'Intermediate', 'Advanced'])
  level?: string;

  @IsNotEmpty()
  @IsString()
  reason: string; // Mandatory field for changelog

  // Note: Domain associations are updated via separate link/unlink endpoints
}
