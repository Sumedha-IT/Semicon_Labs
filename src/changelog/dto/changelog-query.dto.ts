import { IsOptional, IsString, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class ChangeLogQueryDto {
  @IsOptional()
  @IsString()
  changeType?: string; // 'domain', 'module', 'topic'

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  changeTypeId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 10;
}

