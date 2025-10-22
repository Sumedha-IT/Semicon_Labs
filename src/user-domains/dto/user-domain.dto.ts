import { ArrayNotEmpty, IsArray, IsInt, Min, IsOptional, IsIn } from 'class-validator';
import { IsUniqueArray } from '../../common/decorator/is-unique-array.decorator';
import { BaseQueryDto } from '../../common/dto/base-query.dto';

export class LinkUserToDomainsDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsInt({ each: true })
  @Min(1, { each: true })
  @IsUniqueArray({
    message:
      'domainIds must contain only unique values (duplicate domain IDs found)',
  })
  domainIds: number[];
}

export class UserDomainQueryDto extends BaseQueryDto {
  @IsOptional()
  @IsIn(['name', 'createdOn'], {
    message: 'sortBy must be one of: name, createdOn',
  })
  sortBy?: string = 'name';
}

