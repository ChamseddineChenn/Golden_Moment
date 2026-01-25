import { TicketTypes } from '../event.schema';
import { IsString, IsOptional, IsNumber, IsBoolean } from 'class-validator';

export class CreateEventDto {
  @IsString()
  name: string;

  @IsOptional()
  description?: string;

  @IsOptional()
  longDescription?: string;

  @IsOptional()
  coverImage?: string;

  @IsOptional()
  coverImagePublicId?: string;

  @IsString()
  date: Date | string;

  @IsString()
  venue: string;

  @IsOptional()
  @IsNumber()
  totalSeats?: number;

  @IsOptional()
  ticketTypes?: TicketTypes | any;

  @IsOptional()
  seatingLayout?: any;

  @IsOptional()
  sections?: Array<{
    id: string;
    name: string;
    orientation: 'vertical' | 'horizontal';
    columns: number;
    rows: number;
    priceModifier: number;
    accessibility: boolean;
  }>;

  @IsOptional()
  category?: string;

  @IsOptional()
  @IsBoolean()
  isDraft?: boolean;

  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;

  @IsOptional()
  seatingEnabled?: boolean;
}
