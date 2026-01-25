import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export enum LogAction {
  // User actions
  USER_LOGIN = 'USER_LOGIN',
  USER_LOGOUT = 'USER_LOGOUT',
  USER_SIGNUP = 'USER_SIGNUP',
  USER_UPDATE = 'USER_UPDATE',
  USER_DELETE = 'USER_DELETE',
  
  // Admin actions
  ADMIN_VERIFY_ORGANIZER = 'ADMIN_VERIFY_ORGANIZER',
  ADMIN_DEACTIVATE_USER = 'ADMIN_DEACTIVATE_USER',
  ADMIN_DELETE_USER = 'ADMIN_DELETE_USER',
  ADMIN_CREATE_EVENT = 'ADMIN_CREATE_EVENT',
  ADMIN_UPDATE_EVENT = 'ADMIN_UPDATE_EVENT',
  ADMIN_DELETE_EVENT = 'ADMIN_DELETE_EVENT',
  
  // Event actions
  EVENT_CREATE = 'EVENT_CREATE',
  EVENT_CREATED = 'EVENT_CREATED',
  EVENT_UPDATE = 'EVENT_UPDATE',
  EVENT_UPDATED = 'EVENT_UPDATED',
  EVENT_DELETE = 'EVENT_DELETE',
  EVENT_DELETED = 'EVENT_DELETED',
  EVENT_PUBLISH = 'EVENT_PUBLISH',
  EVENT_UNPUBLISH = 'EVENT_UNPUBLISH',
  
  // Ticket actions
  TICKET_CREATE = 'TICKET_CREATE',
  TICKET_PURCHASED = 'TICKET_PURCHASED',
  TICKET_UPDATE = 'TICKET_UPDATE',
  TICKET_DELETE = 'TICKET_DELETE',
  TICKET_DELETED = 'TICKET_DELETED',
  TICKET_VALIDATE = 'TICKET_VALIDATE',
  TICKET_REFUND = 'TICKET_REFUND',
  
  // Seat actions
  SEAT_RESERVE = 'SEAT_RESERVE',
  SEAT_RELEASE = 'SEAT_RELEASE',
  
  // Other actions
  SYSTEM_ERROR = 'SYSTEM_ERROR',
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
