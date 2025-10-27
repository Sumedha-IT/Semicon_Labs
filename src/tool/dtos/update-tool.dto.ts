import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class UpdateToolDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

   @IsNotEmpty()
    @IsString()
    reason: string; // Mandatory field for changelog
}
