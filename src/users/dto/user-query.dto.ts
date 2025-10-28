import {
  IsOptional,
  IsString,
  IsNumber,
  IsEnum,
  IsBoolean,
  IsDateString,
  Max,
  IsIn,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { BaseQueryDto } from '../../common/dto/base-query.dto';
import { UserRole } from '../../common/constants/user-roles';

export enum SortBy {
  NAME = 'name',
  EMAIL = 'email',
  ROLE = 'role',
  JOINED_ON = 'joinedOn',
  UPDATED_ON = 'updatedOn',
  LOCATION = 'location',
  USER_PHONE = 'userPhone',
}

/**
 * User Query DTO
 * Extends BaseQueryDto with user-specific filters and sorting options
 */
export class UserQueryDto extends BaseQueryDto {
  // Override limit with max constraint
  @IsOptional()
  @Type(() => Number)
  @Max(10, { message: 'Limit cannot exceed 10' })
  limit?: number = 10;

  // User-specific sorting
  @IsOptional()
  @IsEnum(SortBy, {
    message:
      'SortBy must be one of: name, email, role, joinedOn, updatedOn, location, userPhone',
  })
  sortBy?: SortBy = SortBy.EMAIL;

  // Basic Filters
  @IsOptional()
  @IsEnum(UserRole, {
    message:
      'Role must be one of: PlatformAdmin, ClientAdmin, Manager, Learner',
  })
  role?: UserRole;

  @IsOptional()
  @Transform(({ value }) => {
    if (value === null || value === undefined || value === '') return undefined;
    const num = Number(value);
    return isNaN(num) ? undefined : num;
  })
  @IsNumber({}, { message: 'Organization ID must be a number' })
  orgId?: number;

  @IsOptional()
  @Transform(({ value }) => {
    if (value === null || value === undefined || value === '') return undefined;
    const num = Number(value);
    return isNaN(num) ? undefined : num;
  })
  @IsNumber({}, { message: 'Manager ID must be a number' })
  managerId?: number;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean({ message: 'Active must be a boolean value' })
  @Transform(({ value }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  })
  active?: boolean;

  // Location Filter
  @IsOptional()
  @IsString({ message: 'Location must be a string' })
  location?: string;

  // Device Filter
  @IsOptional()
  @IsString({ message: 'Device number must be a string' })
  deviceNo?: string;

  // Tool and Domain Filters
  @IsOptional()
  @Transform(({ value }) => {
    if (value === null || value === undefined || value === '') return undefined;
    const num = Number(value);
    return isNaN(num) ? undefined : num;
  })
  @IsNumber({}, { message: 'Tool ID must be a number' })
  toolId?: number;

  // Date Range Filters
  @IsOptional()
  @IsDateString(
    {},
    { message: 'Joined after must be a valid date in YYYY-MM-DD format' },
  )
  joinedAfter?: string;

  @IsOptional()
  @IsDateString(
    {},
    { message: 'Joined before must be a valid date in YYYY-MM-DD format' },
  )
  joinedBefore?: string;

  @IsOptional()
  @IsDateString(
    {},
    { message: 'Updated after must be a valid date in YYYY-MM-DD format' },
  )
  updatedAfter?: string;

  @IsOptional()
  @IsDateString(
    {},
    { message: 'Updated before must be a valid date in YYYY-MM-DD format' },
  )
  updatedBefore?: string;

  // search is inherited from BaseQueryDto

  // Phone Filter
  @IsOptional()
  @IsString({ message: 'Phone number must be a string' })
  phone?: string;

  // Deleted users filter
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean({ message: 'Deleted must be a boolean value' })
  @Transform(({ value }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  })
  deleted?: boolean;
}
