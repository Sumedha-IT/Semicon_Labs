import { IsOptional, IsString } from 'class-validator';

export class UpdateUserTopicDto {
  @IsOptional()
  @IsString()
  status?: string; // 'todo', 'inProgress', 'completed'
}

