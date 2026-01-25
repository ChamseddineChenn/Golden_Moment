import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types, Schema as MongooseSchema } from 'mongoose';

// Define subdocument for ticket seat info
@Schema({ _id: false })
class TicketSeat {
  @Prop({ required: true })
  sectionId: string;

  @Prop({ required: true })
  seatId: string;
}

export type PaymentDocument = Payment & Document;

@Schema({ timestamps: true })
export class Payment {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Event', required: true })
  eventId: Types.ObjectId;

  @Prop({
    type: [
      MongooseSchema.Types.Mixed, // Allow both TicketSeat objects and "auto-assigned" string
    ],
    required: true,
  })
  ticketIds: (TicketSeat | string)[];

  @Prop({ required: true })
  amount: number;

  @Prop({ required: true })
  currency: string;

  @Prop({ required: true })
  stripePaymentIntentId: string;

  @Prop({
    enum: ['pending', 'succeeded', 'failed', 'cancelled'],
    default: 'pending',
  })
  status: string;

  @Prop()
  failureReason?: string;

  @Prop()
  receiptUrl?: string;

  @Prop({ type: Date })
  paidAt?: Date;

  @Prop({ type: MongooseSchema.Types.Mixed })
  metadata?: Record<string, any>;
}

export const PaymentSchema = SchemaFactory.createForClass(Payment);
