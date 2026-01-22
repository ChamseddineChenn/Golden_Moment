import {
  IsEmail,
  IsOptional,
  IsString,
  IsUrl,
  IsDate,
  MinLength,
  MaxLength,
  Matches,
} from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateBaseProfileDto {
  @IsOptional()
  @IsEmail()
  email?: string;
}

export class UpdateOrganizerProfileDto extends UpdateBaseProfileDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  organizationName?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\+?[1-9]\d{1,14}$/, {
    message: 'Phone number must be in valid international format',
  })
  phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  address?: string;

  @IsOptional()
  @IsUrl()
  website?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsString()
  businessLicense?: string;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  organizationEstablishedDate?: Date;
}

export class UpdateAdminProfileDto extends UpdateBaseProfileDto {
  @IsOptional()
  @IsString()
  department?: string;
}
