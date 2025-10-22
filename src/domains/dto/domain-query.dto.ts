import { IsOptional, IsIn } from 'class-validator';
import { BaseQueryDto } from '../../common/dto/base-query.dto';

/**
 * Domain Query DTO
 * Extends BaseQueryDto with domain-specific sorting options
 */
export class DomainQueryDto extends BaseQueryDto {
  @IsOptional()
  @IsIn(['name', 'createdOn'], {
    message: 'Sort by must be either name or createdOn',
  })
  sortBy?: string = 'name';
}

