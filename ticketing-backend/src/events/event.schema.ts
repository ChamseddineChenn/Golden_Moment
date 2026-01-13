import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

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

  @Prop({ type: Object, default: {} })
  seatingLayout: Record<string, any>;

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
