import { IsArray, ArrayMinSize, IsInt, IsPositive } from 'class-validator';

export class LinkDomainsDto {
  @IsArray()
  @ArrayMinSize(1, { message: 'At least one domain ID must be provided' })
  @IsInt({ each: true, message: 'Each domain ID must be an integer' })
  @IsPositive({ each: true, message: 'Each domain ID must be positive' })
  domainIds: number[];
}
