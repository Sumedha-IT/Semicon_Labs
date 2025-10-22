import { IsString, IsNotEmpty, IsNumber, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateDocContentDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title: string;

  @Type(() => Number)
  @IsNumber()
  @IsNotEmpty()
  topicId: number;
}

