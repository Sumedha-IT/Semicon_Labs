import { IsInt, Min, IsOptional } from 'class-validator';

export class CreateModuleTopicDto {
  @IsInt()
  @Min(1)
  module_id: number;

  @IsInt()
  @Min(1)
  topic_id: number;

  @IsInt()
  @Min(1)
  @IsOptional()
  topic_order?: number;
}
