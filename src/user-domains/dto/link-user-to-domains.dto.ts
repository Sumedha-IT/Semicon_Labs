import { ArrayNotEmpty, IsArray, IsInt, Min } from 'class-validator';
import { IsUniqueArray } from '../../common/decorator/is-unique-array.decorator';

export class LinkUserToDomainsDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsInt({ each: true })
  @Min(1, { each: true })
  @IsUniqueArray({ message: 'domainIds must contain only unique values (duplicate domain IDs found)' })
  domainIds: number[];
}


