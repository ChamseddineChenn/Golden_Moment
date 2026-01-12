import { Types } from 'mongoose';

export class CreateTicketDto {
  eventId: string | Types.ObjectId;
  seatNumber: string;
  buyerEmail?: string;
  buyerName?: string;
  metadata?: Record<string, any>;
}
