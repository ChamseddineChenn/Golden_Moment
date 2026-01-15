import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type LoginAttemptDocument = LoginAttempt & Document;

@Schema({ timestamps: true })
export class LoginAttempt {
  @Prop({ required: true, lowercase: true })
  email: string;

  @Prop({ required: true })
  ipAddress: string;

  @Prop()
  userAgent: string;

  @Prop({ required: true })
  successful: boolean;

  @Prop({ type: Date, default: Date.now })
  attemptedAt: Date;
}

export const LoginAttemptSchema = SchemaFactory.createForClass(LoginAttempt);

// Indexes
LoginAttemptSchema.index({ email: 1, attemptedAt: -1 });

// TTL index - automatically delete documents after 1 hour
LoginAttemptSchema.index({ attemptedAt: 1 }, { expireAfterSeconds: 3600 });
