import { IsInt, Min, IsOptional, IsArray, ArrayMinSize } from 'class-validator';
import { Type } from 'class-transformer';

export class LinkTopicDto {
  @IsArray()
  @ArrayMinSize(1, { message: 'topicIds array must contain at least one topic ID' })
  @IsInt({ each: true })
  @Min(1, { each: true })
  @Type(() => Number)
  topicIds: number[];
}


