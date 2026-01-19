import { IsNotEmpty, IsString, IsOptional, IsEnum, IsArray } from 'class-validator';
import { SignupDto } from './signup.dto';
import { AdminLevel } from '../../users/schemas/admin.schema';

export class SignupAdminDto extends SignupDto {
  @IsEnum(AdminLevel)
  @IsOptional()
  adminLevel?: AdminLevel;

  @IsArray()
  @IsOptional()
  permissions?: string[];

  @IsString()
  @IsOptional()
  department?: string;

  @IsString()
  @IsOptional()
  employeeId?: string;
}
