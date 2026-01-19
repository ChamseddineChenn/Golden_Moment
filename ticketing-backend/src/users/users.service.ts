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
import { Organizer, OrganizerDocument } from './schemas/organizer.schema';
import { Admin, AdminDocument } from './schemas/admin.schema';
import { CreateUserDto } from './dto/create-user.dto';
import { UserType } from './enums/user-type.enum';

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

  async create(
    createUserDto: CreateUserDto & { userType?: UserType; [key: string]: any },
  ): Promise<UserDocument> {
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

    const userData: any = {
      email: createUserDto.email,
      password: hashedPassword,
      emailVerificationToken: hashedToken,
      emailVerificationExpires: new Date(Date.now() + 24 * 60 * 60 * 1000),
    };

    // Add type-specific fields
    const userType = createUserDto.userType || UserType.USER;

    if (userType === UserType.ORGANIZER) {
      userData.organizationName = createUserDto.organizationName;
      userData.phone = createUserDto.phone;
      userData.address = createUserDto.address;
      userData.businessLicense = createUserDto.businessLicense;
      userData.website = createUserDto.website;
      userData.description = createUserDto.description;
      userData.organizationEstablishedDate =
        createUserDto.organizationEstablishedDate;
    } else if (userType === UserType.ADMIN) {
      userData.adminLevel = createUserDto.adminLevel;
      userData.permissions = createUserDto.permissions || [];
      userData.department = createUserDto.department;
      userData.employeeId = createUserDto.employeeId;
      userData.adminSince = new Date();
    }

    // Create with discriminator
    const user = new this.userModel(userData);
    await user.save();

    // Return plain token (not hashed) to send in email
    (user as any).plainVerificationToken = verificationToken;

    return user;
  }

  async createOrganizer(organizerData: any): Promise<OrganizerDocument> {
    return this.create({
      ...organizerData,
      userType: UserType.ORGANIZER,
    }) as any;
  }

  async createAdmin(adminData: any): Promise<AdminDocument> {
    return this.create({ ...adminData, userType: UserType.ADMIN }) as any;
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

  async findAllOrganizers(): Promise<OrganizerDocument[]> {
    return this.userModel.find({ userType: UserType.ORGANIZER }).exec() as any;
  }

  async findAllAdmins(): Promise<AdminDocument[]> {
    return this.userModel.find({ userType: UserType.ADMIN }).exec() as any;
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
    user.passwordResetExpires = new Date(Date.now() + 60 * 60 * 1000);

    await user.save();

    return resetToken;
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

  async verifyOrganizer(organizerId: string): Promise<any> {
    const organizer = await this.userModel.findById(organizerId).exec();

    if (!organizer || organizer.userType !== UserType.ORGANIZER) {
      throw new BadRequestException('User is not an organizer');
    }

    (organizer as any).isVerifiedOrganizer = true;
    await organizer.save();

    return {
      success: true,
      message: 'Organizer verified successfully',
    };
  }

  async deactivateUser(userId: string): Promise<any> {
    const user = await this.userModel.findById(userId).exec();

    if (!user) {
      throw new NotFoundException('User not found');
    }

    user.isActive = false;
    await user.save();

    return {
      success: true,
      message: 'User deactivated successfully',
    };
  }

  async deleteUser(userId: string): Promise<any> {
    await this.userModel.findByIdAndDelete(userId).exec();

    return {
      success: true,
      message: 'User deleted successfully',
    };
  }

  async updateProfile(userId: string, updateData: any): Promise<any> {
    delete updateData.password;
    delete updateData.userType;
    delete updateData.isActive;
    delete updateData.emailVerified;

    const user = await this.userModel
      .findByIdAndUpdate(userId, updateData, { new: true })
      .exec();

    return {
      success: true,
      message: 'Profile updated successfully',
      data: user,
    };
  }

  // Check if user is admin
  isAdmin(user: UserDocument): boolean {
    return user.userType === UserType.ADMIN;
  }

  // Check if user is organizer
  isOrganizer(user: UserDocument): boolean {
    return user.userType === UserType.ORGANIZER;
  }

  // Check if user is regular user
  isRegularUser(user: UserDocument): boolean {
    return user.userType === UserType.USER || !user.userType;
  }
}
