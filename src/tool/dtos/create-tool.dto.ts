import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateToolDto {
  @IsNotEmpty()
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;
}
