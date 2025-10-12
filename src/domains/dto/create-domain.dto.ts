import { IsOptional, IsString, Length } from 'class-validator';

export class CreateDomainDto {
  @IsString()
  @Length(1, 100)
  name: string;

  @IsOptional()
  @IsString()
  description?: string;
}


