import { IsString, IsOptional, MaxLength } from 'class-validator';

export class UpdateDocContentDto {
  @IsString()
  @IsOptional()
  @MaxLength(200)
  title?: string;

  @IsString()
  @IsOptional()
  reason?: string; // For changelog
}

