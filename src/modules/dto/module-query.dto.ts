import { IsOptional, IsIn } from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { BaseQueryDto } from '../../common/dto/base-query.dto';

/**
 * Module Query DTO
 * Extends BaseQueryDto with module-specific filters and sorting options
 */
export class ModuleQueryDto extends BaseQueryDto {
  @IsOptional()
  @Type(() => Number)
  domainId?: number;

  @IsOptional()
  @Transform(({ value }) => {
    if (!value) return value;
    // Capitalize first letter: beginner -> Beginner
    return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
  })
  @IsIn(['Beginner', 'Intermediate', 'Advanced'], {
    message: 'Level must be Beginner, Intermediate, or Advanced',
  })
  level?: string;

  @IsOptional()
  @IsIn(['title', 'createdOn', 'level', 'duration'], {
    message: 'Sort by must be title, createdOn, level, or duration',
  })
  sortBy?: string = 'createdOn';

  // Inherits from BaseQueryDto:
  // - page?: number = 1
  // - limit?: number = 10
  // - search?: string
  // - sortOrder?: 'ASC' | 'DESC' = 'ASC'
}
