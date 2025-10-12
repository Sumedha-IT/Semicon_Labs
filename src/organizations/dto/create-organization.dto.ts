import { IsString, IsOptional, IsEmail, IsNumber, Length, Matches, IsPositive, IsEnum } from 'class-validator';
import { OrganizationType, Industry } from '../../common/constants/organization-types';

export class CreateOrganizationDto {
  @IsString({ message: 'Organization name must be a string' })
  @Length(2, 100, { message: 'Organization name must be between 2 and 100 characters' })
  @Matches(/^[a-zA-Z0-9\s\-\&\.\,\(\)]+$/, { 
    message: 'Organization name can only contain letters, numbers, spaces, hyphens, ampersands, periods, commas, and parentheses' 
  })
  name: string;

  @IsString({ message: 'Description must be a string' })
  @Length(1, 1000, { message: 'Description must be between 1 and 1000 characters' })
  description: string;

  @IsEnum(OrganizationType, { 
    message: 'Organization type must be one of: semicon, corporate, startup, university, government, other' 
  })
  type: OrganizationType;

  @IsEnum(Industry, { 
    message: 'Industry must be one of: IT, Telecom, Healthcare, Finance, Education, Manufacturing, Retail, Automotive, Energy, Agriculture, Other' 
  })
  industry: Industry;

  @IsString({ message: 'Location must be a string' })
  @Length(2, 150, { message: 'Location must be between 2 and 150 characters' })
  @Matches(/^[a-zA-Z0-9\s\-,\.]+$/, { 
    message: 'Location can only contain letters, numbers, spaces, hyphens, commas, and periods' 
  })
  location: string;

  @IsString({ message: 'POC name must be a string' })
  @Length(2, 100, { message: 'POC name must be between 2 and 100 characters' })
  @Matches(/^[a-zA-Z\s\-'\.]+$/, { 
    message: 'POC name can only contain letters, spaces, hyphens, apostrophes, and periods' 
  })
  poc_name: string;

  @IsString({ message: 'POC phone must be a string' })
  @Matches(/^\d{10}$/, { message: 'POC phone must be exactly 10 digits' })
  @Length(10, 10, { message: 'POC phone must be exactly 10 digits' })
  poc_phone: string;

  @IsEmail({}, { message: 'POC email must be in valid format (e.g., contact@domain.com)' })
  poc_email: string;

  @IsNumber({}, { message: 'Subscription ID must be a valid number' })
  @IsPositive({ message: 'Subscription ID must be a positive number' })
  subscription_id: number;
}
