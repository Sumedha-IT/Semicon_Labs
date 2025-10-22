import { ArrayNotEmpty, IsArray, IsInt, Min } from 'class-validator';

/**
 * DTO for linking modules to a domain
 */
export class LinkDomainModulesDto {
  @IsArray({ message: 'Module IDs must be an array' })
  @ArrayNotEmpty({ message: 'Module IDs array cannot be empty' })
  @IsInt({ each: true, message: 'Each module ID must be an integer' })
  @Min(1, { each: true, message: 'Each module ID must be at least 1' })
  moduleIds: number[];
}


