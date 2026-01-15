import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export interface Seat {
  seatId: string;
  row: number;
  column: string; // A, B, C, etc.
  status: 'available' | 'reserving' | 'unavailable'; // available, reserving (temp hold), unavailable (sold)
  reservingUntil?: Date; // When the reservation expires
}

export interface SeatSection {
  id: string;
  name: string;
  priceModifier?: number; // Multiplier or fixed amount
  accessibility?: boolean;
  seats: Seat[]; // Matrix of seats with statuses
}

export interface SeatingConfiguration {
  enabled: boolean;
  sections: SeatSection[];
}

export interface TicketType {
  enabled: boolean;
  price?: number; // Only for non-Free types
}

export interface EarlyBirdTicketType extends TicketType {
  limit?: number; // Max tickets to sell at this price
}

export interface TicketTypes {
  Free: TicketType;
  Standard: TicketType;
  EarlyBird: EarlyBirdTicketType;
  VIP: TicketType;
}

@Schema({ timestamps: true })
export class Event extends Document {
  @Prop({ required: true })
  name: string;

  @Prop()
  description: string;

  @Prop()
  longDescription: string;

  @Prop()
  coverImage: string; // Cloudinary URL

  @Prop()
  coverImagePublicId?: string; // Cloudinary public_id for deletion

  @Prop({ required: true })
  date: Date;

  @Prop({ required: true })
  venue: string;

  @Prop({ type: Object, default: { enabled: false, sections: [] } })
  seatingLayout: SeatingConfiguration;

  @Prop({ default: 0 })
  soldTickets: number;

  @Prop({ default: 0 })
  totalSeats: number;

  @Prop({
    type: Object,
    default: {
      Free: { enabled: true, price: 0 },
      Standard: { enabled: false, price: 0 },
      EarlyBird: { enabled: false, price: 0, limit: 0 },
      VIP: { enabled: false, price: 0 },
    },
  })
  ticketTypes: TicketTypes;

  @Prop({ default: 0 })
  earlyBirdCount: number;

  @Prop({ default: true })
  isActive: boolean;

  @Prop({ enum: ['Movies', 'Theatre', 'Concert', 'Sahra'], default: 'Concert' })
  category: string;

  @Prop({ default: true })
  isDraft: boolean;

  @Prop({ default: false })
  isPublished: boolean;
}

export const EventSchema = SchemaFactory.createForClass(Event);
