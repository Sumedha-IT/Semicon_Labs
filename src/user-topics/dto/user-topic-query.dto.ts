import {
  IsOptional,
  IsString,
  IsInt,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { BaseQueryDto } from '../../common/dto/base-query.dto';

export class UserTopicQueryDto extends BaseQueryDto {
  @IsOptional()
  @IsString()
  status?: string; // 'todo', 'inProgress', 'completed'

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  moduleId?: number; // filter by specific module

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  topicId?: number; // filter by specific topic
}

