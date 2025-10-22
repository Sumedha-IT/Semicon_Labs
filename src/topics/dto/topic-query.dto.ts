import {
  IsOptional,
  IsString,
  IsInt,
  IsPositive,
  IsIn,
} from 'class-validator';
import { Type } from 'class-transformer';
import { BaseQueryDto } from '../../common/dto/base-query.dto';

export class TopicQueryDto extends BaseQueryDto {
  // Topic-specific filters
  @IsOptional()
  @IsString()
  @IsIn(['Beginner', 'Intermediate', 'Advanced'])
  level?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  moduleId?: number;

  // Topic-specific sort fields
  @IsOptional()
  @IsString()
  @IsIn(['title', 'level', 'createdAt', 'updatedAt'])
  sortBy?: string = 'title';
}

