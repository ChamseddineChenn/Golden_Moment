import { IsString, IsOptional, IsNumber, IsBoolean, IsObject, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { TicketTypes } from '../event.schema';

export class CreateEventDto {
  @IsString()
  name: string;

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

  @IsString()
  date: Date | string;

  @IsString()
  venue: string;

  @IsOptional()
  @IsNumber()
  totalSeats?: number;

  @IsOptional()
  @IsObject()
  ticketTypes?: TicketTypes | any;

  @IsOptional()
  @IsObject()
  seatingLayout?: Record<string, any>;

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
  @IsObject()
  sections?: any[];
}

