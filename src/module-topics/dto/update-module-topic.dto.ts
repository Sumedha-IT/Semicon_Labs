import { IsInt, Min } from 'class-validator';

export class UpdateModuleTopicDto {
  @IsInt()
  @Min(1)
  topic_order: number;
}
