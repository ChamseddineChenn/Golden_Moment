import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { Role } from '../enums/role.enum';

export type UserDocument = User & Document;

@Schema({ timestamps: true })
export class User {
  @Prop({ required: true, unique: true, lowercase: true, trim: true })
  email: string;

  @Prop({ required: true, select: false })
  password: string;

  @Prop({ type: String, enum: Role, default: Role.USER })
  role: Role;

  @Prop({ default: true })
  isActive: boolean;

  @Prop({ default: false })
  emailVerified: boolean;

  @Prop({ type: Date })
  lastLoginAt?: Date;

  @Prop({ type: String, select: false })
  refreshTokenHash?: string;

  id?: string;
}

export const UserSchema = SchemaFactory.createForClass(User);

UserSchema.virtual('id').get(function (this: UserDocument) {
  return this._id.toHexString();
});

UserSchema.set('toJSON', {
  virtuals: true,
  transform: function (doc, ret) {
    delete ret.password;
    delete ret.refreshTokenHash;
    delete ret.__v;
    return ret;
  },
});

UserSchema.set('toObject', {
  virtuals: true,
  transform: function (doc, ret) {
    delete ret.password;
    delete ret.refreshTokenHash;
    delete ret.__v;
    return ret;
  },
});

UserSchema.index({ email: 1 });
