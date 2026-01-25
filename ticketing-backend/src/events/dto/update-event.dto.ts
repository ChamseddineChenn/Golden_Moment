import {
  IsOptional,
  IsString,
  IsBoolean,
  IsDate,
  IsObject,
} from 'class-validator';
import { Type } from 'class-transformer';
import { SeatingConfiguration, TicketTypes } from '../event.schema';

export class UpdateEventDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  longDescription?: string;

  @IsOptional()
  @IsString()
  coverImage?: string;

  @IsOptional()
  @IsString()
  coverImagePublicId?: string;

  @IsOptional()
  @Type(() => Date)
  date?: Date | string;

  @IsOptional()
  @IsString()
  venue?: string;

  @IsOptional()
  @IsObject()
  ticketTypes?: TicketTypes | any;

  @IsOptional()
  @IsObject()
  seatingLayout?: SeatingConfiguration;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsBoolean()
  isDraft?: boolean;

  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  totalSeats?: number;
}
