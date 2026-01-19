import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { User } from './user.schema';

export type OrganizerDocument = Organizer & Document;

@Schema()
export class Organizer extends User {
  @Prop({ required: true })
  organizationName: string;

  @Prop({ required: true })
  phone: string;

  @Prop()
  address?: string;

  @Prop()
  businessLicense?: string;

  @Prop()
  website?: string;

  @Prop()
  description?: string;

  @Prop({ default: false })
  isVerifiedOrganizer: boolean;

  @Prop({ type: Date })
  organizationEstablishedDate?: Date;

  @Prop({ default: 0 })
  totalEventsCreated: number;

  @Prop({ default: 0 })
  totalTicketsSold: number;

  @Prop({ default: 0 })
  totalRevenue: number;
}

export const OrganizerSchema = SchemaFactory.createForClass(Organizer);
