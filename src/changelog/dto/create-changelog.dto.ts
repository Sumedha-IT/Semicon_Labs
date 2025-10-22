import { IsNotEmpty, IsString, IsNumber, IsOptional } from 'class-validator';

export class CreateChangeLogDto {
  @IsNotEmpty()
  @IsString()
  changeType: string; // 'domain', 'module', 'topic'

  @IsNotEmpty()
  @IsNumber()
  changeTypeId: number;

  @IsNotEmpty()
  @IsNumber()
  userId: number;

  @IsOptional()
  @IsString()
  reason?: string;
}

