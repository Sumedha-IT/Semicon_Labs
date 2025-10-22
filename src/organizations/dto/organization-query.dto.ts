import {
  IsOptional,
  IsIn,
  IsString,
  IsDateString,
  IsInt,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';
import { BaseQueryDto } from '../../common/dto/base-query.dto';

/**
 * Organization Query DTO
 * Extends BaseQueryDto with organization-specific filters and sorting options
 */
export class OrganizationQueryDto extends BaseQueryDto {
  // Override limit with different max constraint
  @IsOptional()
  @Type(() => Number)
  @Max(100, { message: 'Limit cannot exceed 100' })
  limit?: number = 10;

  // Organization-specific sorting
  @IsOptional()
  @IsIn(['name', 'createdOn', 'updatedOn', 'location', 'type'], {
    message: 'Sort by must be name, createdOn, updatedOn, location, or type',
  })
  sortBy?: string = 'name';

  @IsOptional()
  @IsString()
  @IsIn([
    'semicon',
    'corporate',
    'startup',
    'university',
    'government',
    'other',
  ])
  type?: string;

  @IsOptional()
  @IsString()
  @IsIn([
    'IT',
    'Telecom',
    'Healthcare',
    'Finance',
    'Education',
    'Manufacturing',
    'Retail',
    'Automotive',
    'Energy',
    'Agriculture',
    'Other',
  ])
  industry?: string;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  subscriptionId?: number;

  @IsOptional()
  @IsDateString()
  createdAfter?: string;

  @IsOptional()
  @IsDateString()
  createdBefore?: string;

  @IsOptional()
  @IsDateString()
  updatedAfter?: string;

  @IsOptional()
  @IsDateString()
  updatedBefore?: string;

  // search is inherited from BaseQueryDto
}
