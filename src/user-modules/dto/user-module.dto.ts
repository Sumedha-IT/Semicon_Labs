import { IsNumber, IsOptional, IsString, Min, Max, IsInt, IsNotEmpty, Allow, IsDefined } from 'class-validator';
import { Type } from 'class-transformer';

export class EnrollModuleDto {
  @IsDefined({ message: 'module_id is required' })
  @Type(() => Number)
  @IsNumber({}, { message: 'module_id must be a valid number' })
  module_id: number;
}

export class EnrollUserDto {
  @IsDefined({ message: 'user_id is required' })
  @Type(() => Number)
  @IsNumber({}, { message: 'user_id must be a valid number' })
  user_id: number;
}

export class UserModuleQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 10;

  @IsOptional()
  @IsString()
  status?: string; // 'not_started', 'in_progress', 'completed', 'passed', 'failed'

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  module_id?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  user_id?: number;
}

export class ModuleUserQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 10;

  @IsOptional()
  @IsString()
  status?: string; // 'not_started', 'in_progress', 'completed', 'passed', 'failed'

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  score_min?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Max(100)
  score_max?: number;
}

export class UpdateUserModuleDto {
  @IsOptional()
  @IsInt()
  @Min(0)
  questions_answered?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  score?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  threshold_score?: number;

  @IsOptional()
  @IsString()
  status?: string; // 'not_started', 'in_progress', 'completed', 'passed', 'failed' - Auto-set to 'passed'/'failed' when score is updated
}
