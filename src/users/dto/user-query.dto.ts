import {
  IsOptional,
  IsString,
  IsNumber,
  IsEnum,
  IsBoolean,
  IsDateString,
  Min,
  Max,
  IsIn,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { UserRole } from '../../common/constants/user-roles';

export enum SortOrder {
  ASC = 'asc',
  DESC = 'desc',
}

export enum SortBy {
  NAME = 'name',
  EMAIL = 'email',
  ROLE = 'role',
  JOINED_ON = 'joined_on',
  UPDATED_ON = 'updated_on',
  LOCATION = 'location',
  USER_PHONE = 'user_phone',
}

export class UserQueryDto {
  // Pagination
  @IsOptional()
  @Transform(({ value }) => {
    const num = Number(value);
    return isNaN(num) ? 1 : num;
  })
  @IsNumber({}, { message: 'Page must be a number' })
  @Min(1, { message: 'Page must be at least 1' })
  page?: number = 1;

  @IsOptional()
  @Transform(({ value }) => {
    const num = Number(value);
    return isNaN(num) ? 10 : num;
  })
  @IsNumber({}, { message: 'Limit must be a number' })
  @Min(1, { message: 'Limit must be at least 1' })
  @Max(10, { message: 'Limit cannot exceed 10' })
  limit?: number = 10;

  // Sorting
  @IsOptional()
  @IsEnum(SortBy, {
    message:
      'SortBy must be one of: name, email, role, joined_on, updated_on, location, user_phone',
  })
  sortBy?: SortBy = SortBy.EMAIL;

  @IsOptional()
  @IsEnum(SortOrder, { message: 'SortOrder must be either "asc" or "desc"' })
  sortOrder?: SortOrder = SortOrder.ASC;

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

  // Search
  @IsOptional()
  @IsString({ message: 'Search query must be a string' })
  search?: string;

  // Phone Filter
  @IsOptional()
  @IsString({ message: 'Phone number must be a string' })
  phone?: string;
}
