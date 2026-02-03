import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type UserDocument = User & Document;

export enum AuthProvider {
  LOCAL = 'local',
  GOOGLE = 'google',
  FACEBOOK = 'facebook',
}

@Schema({
  timestamps: true,
  discriminatorKey: 'userType',
  collection: 'users',
})
export class User {
  @Prop({ required: true, unique: true, lowercase: true, trim: true })
  email: string;

  @Prop({ select: false })
  password?: string;

  @Prop({ type: String, enum: AuthProvider, default: AuthProvider.LOCAL })
  authProvider: AuthProvider;

  @Prop({ type: String, sparse: true, unique: true })
  googleId?: string;

  @Prop({ type: String, sparse: true, unique: true })
  facebookId?: string;

  @Prop({ type: String })
  firstName?: string;

  @Prop({ type: String })
  lastName?: string;

  @Prop({ type: String })
  avatar?: string;

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
UserSchema.index({ googleId: 1 }, { sparse: true });
UserSchema.index({ facebookId: 1 }, { sparse: true });
UserSchema.index({ authProvider: 1 });
