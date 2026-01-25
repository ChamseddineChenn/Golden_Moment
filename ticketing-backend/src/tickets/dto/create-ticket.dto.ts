import { Types } from 'mongoose';

export class CreateTicketDto {
  eventId: string | Types.ObjectId;
  seats: Array<{ sectionId?: string; seatId: string }>;
  buyerEmail?: string;
  buyerName?: string;
  buyerPhoneNumber?: string;
  ticketType?: 'Free' | 'Standard' | 'EarlyBird' | 'VIP';
  metadata?: Record<string, any>;
}
