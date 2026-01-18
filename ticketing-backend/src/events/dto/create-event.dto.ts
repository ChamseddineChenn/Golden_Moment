import { TicketTypes } from '../event.schema';

export class CreateEventDto {
  name: string;
  description?: string;
  longDescription?: string;
  coverImage?: string;
  date: Date | string; // Accept both Date and string for flexibility
  venue: string;
  totalSeats?: number; // Optional - can be calculated from seatingLayout or provided
  ticketTypes?: TicketTypes | any;
  seatingLayout?: Record<string, any>;
  category?: string;
  isDraft?: boolean;
  isPublished?: boolean;
}
