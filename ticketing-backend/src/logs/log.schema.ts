import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export enum LogAction {
  // Event actions
  EVENT_CREATED = 'EVENT_CREATED',
  EVENT_UPDATED = 'EVENT_UPDATED',
  EVENT_DELETED = 'EVENT_DELETED',
  EVENT_PUBLISH = 'EVENT_PUBLISH',
  EVENT_UNPUBLISH = 'EVENT_UNPUBLISH',
  // Ticket actions
  TICKET_PURCHASE = 'TICKET_PURCHASE',
  TICKET_DELETED = 'TICKET_DELETED',
}

@Schema({ timestamps: true })
export class Log {
  @Prop({ required: true, enum: Object.values(LogAction) })
  action: LogAction;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  userId?: Types.ObjectId;

  @Prop()
  userEmail?: string;

  @Prop()
  eventId?: string;

  @Prop()
  eventName?: string;

  @Prop()
  ticketId?: string;

  @Prop()
  ticketName?: string;

  @Prop()
  performedBy?: string;

  @Prop({ type: Object })
  metadata?: Record<string, any>;

  @Prop()
  ipAddress?: string;

  @Prop()
  userAgent?: string;

  @Prop({ default: Date.now })
  timestamp: Date;
}

export type LogDocument = Log & Document;
export const LogSchema = SchemaFactory.createForClass(Log);

// Add indexes for better query performance
LogSchema.index({ action: 1, timestamp: -1 });
LogSchema.index({ userId: 1, timestamp: -1 });
LogSchema.index({ timestamp: -1 });
