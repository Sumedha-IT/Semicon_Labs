import { IsEmail, IsString, IsOptional, IsDateString, MinLength, Length, Matches, IsPositive, IsNumber, IsEnum } from 'class-validator';
import { UserRole } from '../../common/constants/user-roles';

export class CreateIndividualUserDto {
  @IsString({ message: 'Name must be a string' })
  @Length(2, 100, { message: 'Name must be between 2 and 100 characters' })
  @Matches(/^[a-zA-Z\s\-'\.]+$/, { message: 'Name can only contain letters, spaces, hyphens, apostrophes, and periods' })
  name: string;

  @IsEmail({}, { message: 'Please provide a valid email address' })
  email: string;

  @IsString({ message: 'Password must be a string' })
  @MinLength(8, { message: 'Password must be at least 8 characters long' })
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#])[A-Za-z\d@$!%*?&#]+$/, {
    message: 'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character (@$!%*?&#)'
  })
  password: string;

  @IsOptional()
  @IsString()
  password_hash?: string;

  @IsOptional()
  @IsDateString({}, { message: 'Date of birth must be a valid date in YYYY-MM-DD format' })
  dob?: string;

  @IsString({ message: 'Phone number must be a string' })
  @Matches(/^\d{10}$/, { message: 'Phone number must be exactly 10 digits' })
  @Length(10, 10, { message: 'Phone number must be exactly 10 digits' })
  user_phone: string;

  @IsString({ message: 'Location must be a string' })
  @Length(1, 150, { message: 'Location must be between 1 and 150 characters' })
  location: string;

  @IsString({ message: 'Device number must be a string' })
  @Length(1, 100, { message: 'Device number must be between 1 and 100 characters' })
  @Matches(/^[a-zA-Z0-9\-_]+$/, { message: 'Device number can only contain letters, numbers, hyphens, and underscores' })
  registered_device_no: string;

  @IsNumber({}, { message: 'Tool ID must be a valid number' })
  @IsPositive({ message: 'Tool ID must be a positive number' })
  tool_id: number;

  @IsOptional()
  @IsEnum(UserRole, { message: 'Role must be a valid user role' })
  role?: UserRole;
}
