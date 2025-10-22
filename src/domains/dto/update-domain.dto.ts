import { IsOptional, IsString, Length, IsNotEmpty } from 'class-validator';

export class UpdateDomainDto {
  @IsOptional()
  @IsString()
  @Length(1, 100)
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsNotEmpty()
  @IsString()
  reason: string; // Mandatory field for changelog
}
