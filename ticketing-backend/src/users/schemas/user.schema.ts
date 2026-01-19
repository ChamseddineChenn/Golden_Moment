import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type UserDocument = User & Document;

@Schema({
  timestamps: true,
  discriminatorKey: 'userType',
  collection: 'users',
})
export class User {
  @Prop({ required: true, unique: true, lowercase: true, trim: true })
  email: string;

  @Prop({ required: true, select: false })
  password: string;

  @Prop({ default: true })
  isActive: boolean;

  @Prop({ default: false })
  emailVerified: boolean;

  @Prop({ type: Date })
  lastLoginAt?: Date;

  @Prop({ type: String, select: false })
  refreshTokenHash?: string;

  @Prop({ type: String, select: false })
  emailVerificationToken?: string;

  @Prop({ type: Date })
  emailVerificationExpires?: Date;

  @Prop({ type: String, select: false })
  passwordResetToken?: string;

  @Prop({ type: Date })
  passwordResetExpires?: Date;

  userType?: string;

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
    delete ret.emailVerificationToken;
    delete ret.passwordResetToken;
    delete ret.__v;
    return ret;
  },
});

UserSchema.set('toObject', {
  virtuals: true,
  transform: function (doc, ret) {
    delete ret.password;
    delete ret.refreshTokenHash;
    delete ret.emailVerificationToken;
    delete ret.passwordResetToken;
    delete ret.__v;
    return ret;
  },
});

UserSchema.index({ email: 1 });
UserSchema.index({ emailVerificationToken: 1 });
UserSchema.index({ passwordResetToken: 1 });
UserSchema.index({ userType: 1 });
