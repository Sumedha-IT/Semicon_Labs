import { IsInt, IsOptional, IsIn, IsString, IsDateString, Min, Max, IsNumber } from 'class-validator';
import { Type } from 'class-transformer';

export class OrganizationQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @IsOptional()
  @IsString()
  sortBy?: 'name' | 'created_on' | 'updated_on' | 'location' | 'type';

  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc';

  @IsOptional()
  @IsString()
  @IsIn(['semicon', 'corporate', 'startup', 'university', 'government', 'other'])
  type?: string;

  @IsOptional()
  @IsString()
  @IsIn(['IT', 'Telecom', 'Healthcare', 'Finance', 'Education', 'Manufacturing', 'Retail', 'Automotive', 'Energy', 'Agriculture', 'Other'])
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

  @IsOptional()
  @IsString()
  search?: string;
}
