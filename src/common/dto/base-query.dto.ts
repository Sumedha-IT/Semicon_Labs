import { IsOptional, IsInt, Min, IsIn, IsString } from 'class-validator';
import { Type, Transform } from 'class-transformer';

/**
 * Base Query DTO
 * Contains common pagination, search, and sorting fields
 * All entity-specific query DTOs should extend this class
 */
export class BaseQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Page must be an integer' })
  @Min(1, { message: 'Page must be at least 1' })
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Limit must be an integer' })
  @Min(1, { message: 'Limit must be at least 1' })
  limit?: number = 10;

  @IsOptional()
  @IsString({ message: 'Search must be a string' })
  search?: string;

  @IsOptional()
  @Transform(({ value }) => value?.toLowerCase())
  @IsIn(['asc', 'desc'], { message: 'Sort order must be either asc or desc' })
  sortOrder?: 'asc' | 'desc' = 'asc';

  // Note: sortBy is intentionally not included here
  // Each entity must define its own sortBy with specific allowed fields
}

