import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export enum TicketStatus {
  VALID = 'valid',
  USED = 'used',
  EXPIRED = 'expired',
}

@Schema({ timestamps: true })
export class Ticket extends Document {
  @Prop({ type: Types.ObjectId, ref: 'Event', required: true })
  eventId: Types.ObjectId;

  @Prop({ required: true })
  ticketNumber: string;

  @Prop({ required: true })
  seatNumber: string;

  @Prop()
  buyerEmail: string;

  @Prop()
  buyerName: string;

  @Prop({ required: true })
  qrCode: string;

  @Prop({ default: TicketStatus.VALID, enum: TicketStatus })
  status: TicketStatus;

  @Prop()
  usedAt?: Date;

  @Prop()
  expiresAt?: Date;

  @Prop({ type: Object, default: {} })
  metadata: Record<string, any>;
}

export const TicketSchema = SchemaFactory.createForClass(Ticket);
