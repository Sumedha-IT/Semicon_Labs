import {
  IsString,
  IsNumber,
  IsNotEmpty,
  MaxLength,
  IsIn,
  IsInt,
  IsPositive,
  IsOptional,
  IsArray,
  ArrayMinSize,
} from 'class-validator';

export class CreateModuleDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title: string;

  @IsOptional()
  @IsString()
  desc?: string;

  @IsOptional()
  @IsNumber()
  duration?: number; // Duration in minutes

  @IsOptional()
  @IsString()
  @IsIn(['Beginner', 'Intermediate', 'Advanced'])
  level?: string;

  @IsArray()
  @ArrayMinSize(1, { message: 'At least one domain must be provided' })
  @IsInt({ each: true, message: 'Each domain ID must be an integer' })
  @IsPositive({ each: true, message: 'Each domain ID must be positive' })
  domainIds: number[]; // Array of domain IDs that this module belongs to
}
