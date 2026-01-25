import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types, Schema as MongooseSchema } from 'mongoose';

export type PaymentDocument = Payment & Document;

@Schema({ timestamps: true })
export class Payment {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Event', required: true })
  eventId: Types.ObjectId;

  // Changed to Mixed type to handle both objects and strings
  @Prop({ type: MongooseSchema.Types.Mixed, required: true })
  ticketIds: any[];

  @Prop({ required: true })
  amount: number;

  @Prop({ required: true })
  currency: string;

  @Prop({ required: true })
  stripePaymentIntentId: string;

  @Prop({
    enum: [
      'pending',
      'succeeded',
      'failed',
      'cancelled',
      'ticket_creation_failed',
    ],
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
