import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { User } from './user.schema';

export enum AdminLevel {
  SUPER_ADMIN = 'super_admin',
  ADMIN = 'admin',
  MODERATOR = 'moderator',
}

export type AdminDocument = Admin & Document;

@Schema()
export class Admin extends User {
  @Prop({ type: String, enum: AdminLevel, default: AdminLevel.ADMIN })
  adminLevel: AdminLevel;

  @Prop({ type: [String], default: [] })
  permissions: string[];

  @Prop()
  department?: string;

  @Prop()
  employeeId?: string;

  @Prop({ type: Date })
  adminSince?: Date;

  @Prop({ default: 0 })
  totalActionsPerformed: number;

  @Prop({ type: Date })
  lastAdminActionAt?: Date;
}

export const AdminSchema = SchemaFactory.createForClass(Admin);
