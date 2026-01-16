import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ConfigService } from '@nestjs/config';
import {
  LoginAttempt,
  LoginAttemptDocument,
} from './schemas/login-attempt.schema';

@Injectable()
export class LoginAttemptsService {
  private readonly maxLoginAttempts: number;
  private readonly lockoutDuration: number;

  constructor(
    @InjectModel(LoginAttempt.name)
    private loginAttemptModel: Model<LoginAttemptDocument>,
    private configService: ConfigService,
  ) {
    this.maxLoginAttempts = this.configService.get<number>(
      'security.maxLoginAttempts',
    );
    this.lockoutDuration = this.configService.get<number>(
      'security.lockoutDuration',
    );
  }

  async trackAttempt(
    email: string,
    ipAddress: string,
    userAgent: string,
    successful: boolean,
  ): Promise<void> {
    const attempt = new this.loginAttemptModel({
      email: email.toLowerCase(),
      ipAddress,
      userAgent,
      successful,
      attemptedAt: new Date(),
    });

    await attempt.save();
  }

  async getRecentFailedAttempts(email: string): Promise<number> {
    const cutoffTime = new Date(Date.now() - this.lockoutDuration);

    return this.loginAttemptModel.countDocuments({
      email: email.toLowerCase(),
      successful: false,
      attemptedAt: { $gte: cutoffTime },
    });
  }

  async isAccountLocked(email: string): Promise<boolean> {
    const failedAttempts = await this.getRecentFailedAttempts(email);
    return failedAttempts >= this.maxLoginAttempts;
  }

  async clearAttempts(email: string): Promise<void> {
    // Clear all failed attempts for this email
    await this.loginAttemptModel.deleteMany({
      email: email.toLowerCase(),
      successful: false,
    });
  }
}
