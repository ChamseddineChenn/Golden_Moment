import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { ConfigService } from '@nestjs/config';
import { User, UserDocument } from './schemas/user.schema';
import { CreateUserDto } from './dto/create-user.dto';
import { Role } from './enums/role.enum';

@Injectable()
export class UsersService {
  private readonly bcryptRounds: number;

  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private configService: ConfigService,
  ) {
    this.bcryptRounds =
      this.configService.get<number>('security.bcryptRounds') || 12;
  }

  async create(createUserDto: CreateUserDto): Promise<UserDocument> {
    const existingUser = await this.userModel.findOne({
      email: createUserDto.email,
    });
    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    const hashedPassword = await bcrypt.hash(
      createUserDto.password,
      this.bcryptRounds,
    );

    // Generate email verification token
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto
      .createHash('sha256')
      .update(verificationToken)
      .digest('hex');

    const user = new this.userModel({
      email: createUserDto.email,
      password: hashedPassword,
      role: createUserDto.role || Role.USER,
      emailVerificationToken: hashedToken,
      emailVerificationExpires: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
    });

    await user.save();

    // Return plain token (not hashed) to send in email
    (user as any).plainVerificationToken = verificationToken;

    return user;
  }

  async findByEmail(
    email: string,
    includePassword = false,
  ): Promise<UserDocument | null> {
    const query = this.userModel.findOne({ email: email.toLowerCase() });

    if (includePassword) {
      return query.select('+password').exec();
    }

    return query.exec();
  }

  async findById(id: string): Promise<UserDocument> {
    const user = await this.userModel.findById(id).exec();
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  async updateRefreshToken(
    userId: string,
    refreshToken: string | null,
  ): Promise<void> {
    if (refreshToken) {
      const refreshTokenHash = await bcrypt.hash(
        refreshToken,
        this.bcryptRounds,
      );
      await this.userModel.findByIdAndUpdate(userId, { refreshTokenHash });
    } else {
      await this.userModel.findByIdAndUpdate(userId, {
        refreshTokenHash: null,
      });
    }
  }

  async validateRefreshToken(
    userId: string,
    refreshToken: string,
  ): Promise<boolean> {
    const user = await this.userModel
      .findById(userId)
      .select('+refreshTokenHash')
      .exec();

    if (!user || !user.refreshTokenHash) {
      return false;
    }

    return bcrypt.compare(refreshToken, user.refreshTokenHash);
  }

  async updateLastLogin(userId: string): Promise<void> {
    await this.userModel.findByIdAndUpdate(userId, { lastLoginAt: new Date() });
  }

  async findAll(): Promise<UserDocument[]> {
    return this.userModel.find().exec();
  }

  async verifyEmail(token: string): Promise<UserDocument> {
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    const user = await this.userModel
      .findOne({
        emailVerificationToken: hashedToken,
        emailVerificationExpires: { $gt: Date.now() },
      })
      .exec();

    if (!user) {
      throw new BadRequestException('Invalid or expired verification token');
    }

    user.emailVerified = true;
    user.emailVerificationToken = undefined;
    user.emailVerificationExpires = undefined;

    await user.save();

    return user;
  }

  async createPasswordResetToken(email: string): Promise<string> {
    const user = await this.findByEmail(email);

    if (!user) {
      throw new NotFoundException('No user found with this email');
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto
      .createHash('sha256')
      .update(resetToken)
      .digest('hex');

    user.passwordResetToken = hashedToken;
    user.passwordResetExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await user.save();

    return resetToken; // Return plain token to send in email
  }

  async resetPassword(
    token: string,
    newPassword: string,
  ): Promise<UserDocument> {
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    const user = await this.userModel
      .findOne({
        passwordResetToken: hashedToken,
        passwordResetExpires: { $gt: Date.now() },
      })
      .select('+password')
      .exec();

    if (!user) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    user.password = await bcrypt.hash(newPassword, this.bcryptRounds);
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;

    await user.save();

    return user;
  }

  async resendVerificationEmail(email: string): Promise<string> {
    const user = await this.findByEmail(email);

    if (!user) {
      throw new NotFoundException('No user found with this email');
    }

    if (user.emailVerified) {
      throw new BadRequestException('Email is already verified');
    }

    const verificationToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto
      .createHash('sha256')
      .update(verificationToken)
      .digest('hex');

    user.emailVerificationToken = hashedToken;
    user.emailVerificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await user.save();

    return verificationToken;
  }
}
