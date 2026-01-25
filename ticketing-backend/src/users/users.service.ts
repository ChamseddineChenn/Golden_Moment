import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { ConfigService } from '@nestjs/config';
import { User, UserDocument } from './schemas/user.schema';
import { OrganizerDocument } from './schemas/organizer.schema';
import { AdminDocument } from './schemas/admin.schema';
import { CreateUserDto } from './dto/create-user.dto';
import { UserType } from './enums/user-type.enum';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { LogsService } from '../logs/logs.service';
import { LogAction } from '../logs/log.schema';

@Injectable()
export class UsersService {
  private readonly bcryptRounds: number;

  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private configService: ConfigService,
    private eventEmitter: EventEmitter2,
     private logsService: LogsService,
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

    const userType = createUserDto.userType || UserType.USER;

    const userData: any = {
      email: createUserDto.email,
      password: hashedPassword,
      emailVerificationToken: hashedToken,
      emailVerificationExpires: new Date(Date.now() + 24 * 60 * 60 * 1000),
    };

    // Add type-specific fields based on userType
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

    // Create user with the correct discriminator model
    let user: UserDocument;

    if (userType === UserType.ORGANIZER) {
      const OrganizerModel =
        this.userModel.discriminators?.[UserType.ORGANIZER] || this.userModel;
      user = new OrganizerModel(userData);
    } else if (userType === UserType.ADMIN) {
      const AdminModel =
        this.userModel.discriminators?.[UserType.ADMIN] || this.userModel;
      user = new AdminModel(userData);
    } else {
      user = new this.userModel(userData);
    }

    await user.save();

    const savedUser = await this.userModel.findById(user._id).exec();

    // Emit event for email verification
    this.eventEmitter.emit('user.emailVerificationNeeded', {
      email: savedUser.email,
      token: verificationToken,
      userId: savedUser.id,
    });

    (savedUser as any).plainVerificationToken = verificationToken;

    return savedUser;
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

    // Emit event for email sending
    this.eventEmitter.emit('user.emailVerificationNeeded', {
      email: user.email,
      token: verificationToken,
      userId: user.id,
    });

    return verificationToken;
  }

  async verifyOrganizer(organizerId: string): Promise<any> {
    const organizer = await this.userModel.findById(organizerId).exec();

    if (!organizer || organizer.userType !== UserType.ORGANIZER) {
      throw new BadRequestException('User is not an organizer');
    }

    (organizer as any).isVerifiedOrganizer = true;
    await organizer.save();

    // Log admin action
    if (this.logsService) {
      await this.logsService.createLog(LogAction.ADMIN_VERIFY_ORGANIZER, {
        performedBy: 'admin', // Replace with actual admin user if available
        metadata: { organizerId },
      });
    }

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

    // Log admin action
    if (this.logsService) {
      await this.logsService.createLog(LogAction.ADMIN_DEACTIVATE_USER, {
        performedBy: 'admin', // Replace with actual admin user if available
        metadata: { userId },
      });
    }

    return {
      success: true,
      message: 'User deactivated successfully',
    };
  }

  async deleteUser(userId: string): Promise<any> {
    await this.userModel.findByIdAndDelete(userId).exec();

    // Log admin action
    if (this.logsService) {
      await this.logsService.createLog(LogAction.ADMIN_DELETE_USER, {
        performedBy: 'admin', // Replace with actual admin user if available
        metadata: { userId },
      });
    }

    return {
      success: true,
      message: 'User deleted successfully',
    };
  }

  /**
   * Update user profile with role-based validation and email verification flow
   */
  async updateProfile(
    userId: string,
    userType: string,
    updateData: any,
  ): Promise<any> {
    const user = await this.userModel.findById(userId).exec();

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // CRITICAL: Block restricted fields
    const restrictedFields = [
      'password',
      'userType',
      'isActive',
      'emailVerified',
      'refreshTokenHash',
      'emailVerificationToken',
      'emailVerificationExpires',
      'passwordResetToken',
      'passwordResetExpires',
      'lastLoginAt',
      'createdAt',
      'updatedAt',
      '__v',
      '_id',
      'id',
    ];

    // Admin-specific restricted fields (admins cannot self-modify these)
    const adminRestrictedFields = [
      'adminLevel',
      'permissions',
      'department',
      'employeeId',
      'adminSince',
      'totalActionsPerformed',
      'lastAdminActionAt',
    ];

    // Remove any restricted fields from updateData
    restrictedFields.forEach((field) => delete updateData[field]);

    if (userType === UserType.ADMIN) {
      adminRestrictedFields.forEach((field) => delete updateData[field]);
    }

    // Organizer-specific fields validation
    const organizerOnlyFields = [
      'organizationName',
      'phone',
      'address',
      'businessLicense',
      'website',
      'description',
      'organizationEstablishedDate',
      'isVerifiedOrganizer', // Cannot self-verify
      'totalEventsCreated',
      'totalTicketsSold',
      'totalRevenue',
    ];

    // Prevent non-organizers from updating organizer-only fields
    if (userType !== UserType.ORGANIZER) {
      organizerOnlyFields.forEach((field) => {
        if (updateData[field] !== undefined) {
          throw new ForbiddenException(
            `Only organizers can update the field: ${field}`,
          );
        }
      });
    }

    // Block self-modification of verification status
    delete updateData.isVerifiedOrganizer;
    delete updateData.totalEventsCreated;
    delete updateData.totalTicketsSold;
    delete updateData.totalRevenue;

    // Handle email update with verification flow
    let emailChanged = false;
    let verificationToken: string | null = null;

    if (updateData.email && updateData.email !== user.email) {
      const normalizedEmail = updateData.email.toLowerCase().trim();

      // Check if email is already taken
      const existingUser = await this.userModel.findOne({
        email: normalizedEmail,
        _id: { $ne: userId },
      });

      if (existingUser) {
        throw new ConflictException('Email is already in use');
      }

      // Generate new verification token
      verificationToken = crypto.randomBytes(32).toString('hex');
      const hashedToken = crypto
        .createHash('sha256')
        .update(verificationToken)
        .digest('hex');

      // Update email and reset verification status
      updateData.email = normalizedEmail;
      updateData.emailVerified = false;
      updateData.emailVerificationToken = hashedToken;
      updateData.emailVerificationExpires = new Date(
        Date.now() + 24 * 60 * 60 * 1000,
      );

      emailChanged = true;
    }

    // Apply updates
    Object.assign(user, updateData);
    await user.save();

    // Emit email verification event if email changed
    if (emailChanged && verificationToken) {
      this.eventEmitter.emit('user.emailVerificationNeeded', {
        email: user.email,
        token: verificationToken,
        userId: user.id,
      });
    }

    // Fetch updated user (without sensitive fields)
    const updatedUser = await this.userModel.findById(userId).exec();

    return {
      success: true,
      message: emailChanged
        ? 'Profile updated successfully. Please verify your new email address.'
        : 'Profile updated successfully',
      data: updatedUser,
      emailVerificationRequired: emailChanged,
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
