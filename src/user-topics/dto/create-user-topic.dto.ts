import { IsInt, IsOptional, IsString, Min } from 'class-validator';
import { Type, Transform } from 'class-transformer';

export class CreateUserTopicDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  topicId: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  userModuleId: number;

  @IsOptional()
  @IsString()
  status?: string; // 'todo', 'inProgress', 'completed'
}
