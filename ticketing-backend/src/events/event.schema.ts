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

@Schema({ timestamps: true })
export class Event extends Document {
  @Prop({ required: true })
  name: string;

  @Prop()
  description: string;

  @Prop({ required: true })
  date: Date;

  @Prop({ required: true })
  venue: string;

  @Prop({ required: true })
  totalSeats: number;

  @Prop({ type: Object, default: { enabled: false, sections: [] } })
  seatingLayout: SeatingConfiguration;

  @Prop({ default: 0 })
  soldTickets: number;

  @Prop({ default: 0 })
  ticketPrice: number;

  @Prop({ default: true })
  isActive: boolean;

  @Prop({ enum: ['Movies', 'Theatre', 'Concert', 'Sahra'], default: 'Concert' })
  category: string;
}

export const EventSchema = SchemaFactory.createForClass(Event);
