import { IsNotEmpty, IsNumber, IsString } from 'class-validator';

export class AssignToolDto {
  @IsNotEmpty()
  @IsNumber()
  tool_id: number;

  @IsNotEmpty()
  @IsNumber()
  user_domain_id: number;

}


export class SwitchToolDto {
  @IsNotEmpty()
  @IsNumber()
  tool_id: number;

  @IsNotEmpty()
  @IsNumber()
  user_domain_id: number;

  @IsNotEmpty()
  @IsString()
  reason: string; // Mandatory field for changelog
}