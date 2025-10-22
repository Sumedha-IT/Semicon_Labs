import {
  IsNumber,
  IsOptional,
  IsString,
  Min,
  Max,
  IsInt,
  IsNotEmpty,
  Allow,
  IsDefined,
  IsBoolean,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';

export class EnrollModuleDto {
  @IsDefined({ message: 'moduleId is required' })
  @Type(() => Number)
  @IsNumber({}, { message: 'moduleId must be a valid number' })
  moduleId: number;
}

export class EnrollUserDto {
  @IsDefined({ message: 'userId is required' })
  @Type(() => Number)
  @IsNumber({}, { message: 'userId must be a valid number' })
  userId: number;
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
  status?: string; // 'todo', 'inProgress', 'completed'

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  moduleId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  userId?: number;

  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  })
  @IsBoolean()
  enroll?: boolean; // true = enrolled modules, false = available modules from user's domains

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  domainId?: number; // filter by specific domain
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
  status?: string; // 'todo', 'inProgress', 'completed'

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  scoreMin?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Max(100)
  scoreMax?: number;
}

export class UpdateUserModuleDto {
  @IsOptional()
  @IsInt()
  @Min(0)
  questionsAnswered?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  score?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  thresholdScore?: number;

  @IsOptional()
  @IsString()
  status?: string; // 'todo', 'inProgress', 'completed' - Auto-set to 'completed' when pass, 'inProgress' when fail
}
