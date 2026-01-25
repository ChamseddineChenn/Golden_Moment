import { SeatingConfiguration, TicketTypes } from '../event.schema';

export class UpdateEventDto {
  name?: string;
  description?: string;
  longDescription?: string;
  coverImage?: string;
  date?: Date | string; // Accept both Date and string for flexibility
  venue?: string;
  ticketTypes?: TicketTypes | any;
  seatingLayout?: SeatingConfiguration;
  category?: string;
  isDraft?: boolean;
  isPublished?: boolean;
  isActive?: boolean;
