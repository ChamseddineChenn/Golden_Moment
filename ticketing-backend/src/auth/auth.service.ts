import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import type { Response } from 'express';
import { UsersService } from '../users/users.service';
import { LoginAttemptsService } from '../users/login-attempts.service';
import { MailService } from '../mail/mail.service';
import { SignupDto } from './dto/signup.dto';
import { SignupOrganizerDto } from './dto/signup-organizer.dto';
import { LoginDto } from './dto/login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { ResendVerificationDto } from './dto/resend-verification.dto';
import { UserType } from '../users/enums/user-type.enum';
import { UserDocument } from '../users/schemas/user.schema';

interface UserResponse {
  id: string;
  email: string;
  userType: string;
  emailVerified: boolean;
  organizationName?: string;
  phone?: string;
  isVerifiedOrganizer?: boolean;
  adminLevel?: string;
  permissions?: string[];
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private usersService: UsersService,
    private loginAttemptsService: LoginAttemptsService,
    private jwtService: JwtService,
    private configService: ConfigService,
    private mailService: MailService,
  ) {}

  async signup(signupDto: SignupDto, res: Response) {
    const user = await this.usersService.create({
      email: signupDto.email,
      password: signupDto.password,
      userType: signupDto.userType || UserType.USER,
    });

    // Send verification email
    const verificationToken = (user as any).plainVerificationToken;
    await this.mailService.sendVerificationEmail(user.email, verificationToken);

    const { accessToken, refreshToken } = await this.generateTokens(
      user.id,
      user.email,
      user.userType || UserType.USER,
    );

    await this.usersService.updateRefreshToken(user.id, refreshToken);

    this.setAuthCookies(res, accessToken, refreshToken);

    return {
      success: true,
      message:
        'User registered successfully. Please check your email to verify your account.',
      user: this.formatUserResponse(user),
    };
  }

  async signupOrganizer(signupOrganizerDto: SignupOrganizerDto, res: Response) {
    const user = await this.usersService.createOrganizer({
      email: signupOrganizerDto.email,
      password: signupOrganizerDto.password,
      organizationName: signupOrganizerDto.organizationName,
      phone: signupOrganizerDto.phone,
      address: signupOrganizerDto.address,
      businessLicense: signupOrganizerDto.businessLicense,
      website: signupOrganizerDto.website,
      description: signupOrganizerDto.description,
      organizationEstablishedDate:
        signupOrganizerDto.organizationEstablishedDate,
    });

    // Send verification email
    const verificationToken = (user as any).plainVerificationToken;
    await this.mailService.sendVerificationEmail(user.email, verificationToken);

    const { accessToken, refreshToken } = await this.generateTokens(
      user.id,
      user.email,
      UserType.ORGANIZER,
    );

    await this.usersService.updateRefreshToken(user.id, refreshToken);

    this.setAuthCookies(res, accessToken, refreshToken);

    return {
      success: true,
      message:
        'Organizer registered successfully. Please check your email to verify your account.',
      user: this.formatUserResponse(user),
    };
  }

  async login(
    loginDto: LoginDto,
    ipAddress: string,
    userAgent: string,
    res: Response,
  ) {
    // Check if account is locked
    const isLocked = await this.loginAttemptsService.isAccountLocked(
      loginDto.email,
    );
    if (isLocked) {
      throw new UnauthorizedException(
        'Account temporarily locked due to multiple failed login attempts. Please try again later.',
      );
    }

    // Find user with password
    const user = await this.usersService.findByEmail(loginDto.email, true);

    if (!user) {
      // Track failed attempt
      await this.loginAttemptsService.trackAttempt(
        loginDto.email,
        ipAddress,
        userAgent,
        false,
      );

      // Generic error message to prevent user enumeration
      throw new UnauthorizedException('Invalid credentials');
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(
      loginDto.password,
      user.password,
    );

    if (!isPasswordValid) {
      // Track failed attempt
      await this.loginAttemptsService.trackAttempt(
        loginDto.email,
        ipAddress,
        userAgent,
        false,
      );

      throw new UnauthorizedException('Invalid credentials');
    }

    // Check if user is active
    if (!user.isActive) {
      throw new UnauthorizedException('Account is deactivated');
    }

    // Track successful attempt
    await this.loginAttemptsService.trackAttempt(
      loginDto.email,
      ipAddress,
      userAgent,
      true,
    );

    // Clear previous failed attempts
    await this.loginAttemptsService.clearAttempts(loginDto.email);

    // Update last login
    await this.usersService.updateLastLogin(user.id);

    // Generate tokens
    const { accessToken, refreshToken } = await this.generateTokens(
      user.id,
      user.email,
      user.userType || UserType.USER,
    );

    // Store refresh token hash
    await this.usersService.updateRefreshToken(user.id, refreshToken);

    // Set cookies
    this.setAuthCookies(res, accessToken, refreshToken);

    this.logger.log(`User ${user.email} logged in successfully`);

    return {
      success: true,
      message: 'Login successful',
      user: this.formatUserResponse(user),
    };
  }

  async refreshTokens(
    userId: string,
    email: string,
    userType: string,
    res: Response,
  ) {
    // Convert string to UserType enum
    let userTypeEnum: UserType;
    if (userType === UserType.ADMIN) {
      userTypeEnum = UserType.ADMIN;
    } else if (userType === UserType.ORGANIZER) {
      userTypeEnum = UserType.ORGANIZER;
    } else {
      userTypeEnum = UserType.USER;
    }

    // Generate new tokens
    const { accessToken, refreshToken } = await this.generateTokens(
      userId,
      email,
      userTypeEnum,
    );

    // Update stored refresh token
    await this.usersService.updateRefreshToken(userId, refreshToken);

    // Set new cookies
    this.setAuthCookies(res, accessToken, refreshToken);

    return {
      success: true,
      message: 'Tokens refreshed successfully',
    };
  }

  async logout(userId: string, res: Response) {
    // Clear refresh token from database
    await this.usersService.updateRefreshToken(userId, null);

    // Clear cookies
    this.clearAuthCookies(res);

    return {
      success: true,
      message: 'Logged out successfully',
    };
  }

  async verifyEmail(verifyEmailDto: VerifyEmailDto) {
    const user = await this.usersService.verifyEmail(verifyEmailDto.token);

    return {
      success: true,
      message: 'Email verified successfully',
      user: this.formatUserResponse(user),
    };
  }

  async resendVerification(resendVerificationDto: ResendVerificationDto) {
    const token = await this.usersService.resendVerificationEmail(
      resendVerificationDto.email,
    );
    await this.mailService.sendVerificationEmail(
      resendVerificationDto.email,
      token,
    );

    return {
      success: true,
      message: 'Verification email sent. Please check your inbox.',
    };
  }

  async forgotPassword(forgotPasswordDto: ForgotPasswordDto) {
    try {
      const token = await this.usersService.createPasswordResetToken(
        forgotPasswordDto.email,
      );
      await this.mailService.sendPasswordResetEmail(
        forgotPasswordDto.email,
        token,
      );

      return {
        success: true,
        message: 'Password reset instructions sent to your email',
      };
    } catch (error) {
      // Return success even if user not found (security best practice)
      return {
        success: true,
        message:
          'If an account exists with this email, password reset instructions have been sent',
      };
    }
  }

  async resetPassword(resetPasswordDto: ResetPasswordDto) {
    const user = await this.usersService.resetPassword(
      resetPasswordDto.token,
      resetPasswordDto.newPassword,
    );

    await this.mailService.sendPasswordResetConfirmation(user.email);

    return {
      success: true,
      message:
        'Password reset successfully. You can now log in with your new password.',
    };
  }

  async getCurrentUser(userId: string) {
    const user = await this.usersService.findById(userId);
    return {
      success: true,
      user: this.formatUserResponse(user),
    };
  }

  private async generateTokens(
    userId: string,
    email: string,
    userType: UserType | string,
  ) {
    const payload = {
      sub: userId,
      email,
      userType: userType.toString(),
    };

    const accessSecret =
      this.configService.get<string>('jwt.accessSecret') || 'access-secret';
    const refreshSecret =
      this.configService.get<string>('jwt.refreshSecret') || 'refresh-secret';

    const accessToken = this.jwtService.sign(payload, {
      secret: accessSecret,
      expiresIn: '15m',
    });

    const refreshToken = this.jwtService.sign(payload, {
      secret: refreshSecret,
      expiresIn: '7d',
    });

    return { accessToken, refreshToken };
  }

  private setAuthCookies(
    res: Response,
    accessToken: string,
    refreshToken: string,
  ) {
    const isProduction =
      this.configService.get<string>('NODE_ENV') === 'production';

    // Access token cookie (15 minutes)
    res.cookie('access_token', accessToken, {
      httpOnly: true,
      secure: false, // Set to isProduction in production
      sameSite: 'lax', // Use 'lax' for development, 'strict' for production
      maxAge: 15 * 60 * 1000,
      path: '/',
    });

    // Refresh token cookie (7 days)
    res.cookie('refresh_token', refreshToken, {
      httpOnly: true,
      secure: false, // Set to isProduction in production
      sameSite: 'lax', // Use 'lax' for development, 'strict' for production
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/',
    });
  }

  private clearAuthCookies(res: Response) {
    res.clearCookie('access_token', { path: '/' });
    res.clearCookie('refresh_token', { path: '/' });
  }

  private formatUserResponse(user: UserDocument): UserResponse {
    const baseResponse: any = {
      id: user.id,
      email: user.email,
      userType: user.userType || UserType.USER,
      emailVerified: user.emailVerified,
    };

    // Add type-specific fields based on userType
    if (user.userType === UserType.ORGANIZER) {
      const organizer = user as any;
      baseResponse.organizationName = organizer.organizationName;
      baseResponse.phone = organizer.phone;
      baseResponse.address = organizer.address;
      baseResponse.website = organizer.website;
      baseResponse.description = organizer.description;
      baseResponse.isVerifiedOrganizer = organizer.isVerifiedOrganizer;
      baseResponse.totalEventsCreated = organizer.totalEventsCreated;
      baseResponse.totalTicketsSold = organizer.totalTicketsSold;
    } else if (user.userType === UserType.ADMIN) {
      const admin = user as any;
      baseResponse.adminLevel = admin.adminLevel;
      baseResponse.permissions = admin.permissions;
      baseResponse.department = admin.department;
    }

    return baseResponse;
  }
}
