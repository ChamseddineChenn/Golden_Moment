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

export interface UserResponse {
  id: string;
  email: string;
  userType: string;
  emailVerified: boolean;
  [key: string]: any;
}

export interface AuthResponse {
  success: boolean;
  message: string;
  user: UserResponse;
}

export interface SimpleResponse {
  success: boolean;
  message: string;
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

  async signup(signupDto: SignupDto, res: Response): Promise<AuthResponse> {
    const user = await this.usersService.create({
      email: signupDto.email,
      password: signupDto.password,
      userType: signupDto.userType || UserType.USER,
    });

    const verificationToken = (user as any).plainVerificationToken;
    await this.mailService.sendVerificationEmail(user.email, verificationToken);

    // Use the userType from DTO or default to USER
    const userType = signupDto.userType || UserType.USER;

    const { accessToken, refreshToken } = this.generateTokens(
      user.id,
      user.email,
      userType.toString(), // Ensure it's a string
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

  async signupOrganizer(
    signupOrganizerDto: SignupOrganizerDto,
    res: Response,
  ): Promise<AuthResponse> {
    const user = await this.usersService.createOrganizer(signupOrganizerDto);

    const verificationToken = (user as any).plainVerificationToken;
    await this.mailService.sendVerificationEmail(user.email, verificationToken);

    const { accessToken, refreshToken } = this.generateTokens(
      user.id,
      user.email,
      UserType.ORGANIZER.toString(), // Explicitly set to ORGANIZER
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
  ): Promise<AuthResponse> {
    const isLocked = await this.loginAttemptsService.isAccountLocked(
      loginDto.email,
    );
    if (isLocked) {
      throw new UnauthorizedException(
        'Account temporarily locked due to multiple failed login attempts. Please try again later.',
      );
    }

    const user = await this.usersService.findByEmail(loginDto.email, true);

    if (!user) {
      await this.loginAttemptsService.trackAttempt(
        loginDto.email,
        ipAddress,
        userAgent,
        false,
      );
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(
      loginDto.password,
      user.password,
    );

    if (!isPasswordValid) {
      await this.loginAttemptsService.trackAttempt(
        loginDto.email,
        ipAddress,
        userAgent,
        false,
      );
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('Account is deactivated');
    }

    await this.loginAttemptsService.trackAttempt(
      loginDto.email,
      ipAddress,
      userAgent,
      true,
    );

    await this.loginAttemptsService.clearAttempts(loginDto.email);

    await this.usersService.updateLastLogin(user.id);

    const { accessToken, refreshToken } = this.generateTokens(
      user.id,
      user.email,
      user.userType || UserType.USER,
    );

    await this.usersService.updateRefreshToken(user.id, refreshToken);

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
  ): Promise<SimpleResponse> {
    const { accessToken, refreshToken } = this.generateTokens(
      userId,
      email,
      userType,
    );

    await this.usersService.updateRefreshToken(userId, refreshToken);

    this.setAuthCookies(res, accessToken, refreshToken);

    return {
      success: true,
      message: 'Tokens refreshed successfully',
    };
  }

  async logout(userId: string, res: Response): Promise<SimpleResponse> {
    await this.usersService.updateRefreshToken(userId, null);

    this.clearAuthCookies(res);

    return {
      success: true,
      message: 'Logged out successfully',
    };
  }

  async verifyEmail(verifyEmailDto: VerifyEmailDto): Promise<AuthResponse> {
    const user = await this.usersService.verifyEmail(verifyEmailDto.token);

    return {
      success: true,
      message: 'Email verified successfully',
      user: this.formatUserResponse(user),
    };
  }

  async resendVerification(
    resendVerificationDto: ResendVerificationDto,
  ): Promise<SimpleResponse> {
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

  async forgotPassword(
    forgotPasswordDto: ForgotPasswordDto,
  ): Promise<SimpleResponse> {
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
    } catch (_error) {
      return {
        success: true,
        message:
          'If an account exists with this email, password reset instructions have been sent',
      };
    }
  }

  async resetPassword(
    resetPasswordDto: ResetPasswordDto,
  ): Promise<SimpleResponse> {
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

  private generateTokens(userId: string, email: string, userType: string) {
    const payload = {
      sub: userId,
      email,
      userType: userType || UserType.USER,
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
    res.cookie('access_token', accessToken, {
      httpOnly: true,
      secure: false,
      sameSite: 'lax',
      maxAge: 15 * 60 * 1000,
      path: '/',
    });

    res.cookie('refresh_token', refreshToken, {
      httpOnly: true,
      secure: false,
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/',
    });
  }

  private clearAuthCookies(res: Response) {
    res.clearCookie('access_token', { path: '/' });
    res.clearCookie('refresh_token', { path: '/' });
  }

  async getCurrentUser(
    userId: string,
  ): Promise<{ success: boolean; user: UserResponse }> {
    const user = await this.usersService.findById(userId);
    return {
      success: true,
      user: this.formatUserResponse(user),
    };
  }

  private formatUserResponse(user: any): UserResponse {
    const baseResponse: UserResponse = {
      id: user.id,
      email: user.email,
      userType: user.userType || UserType.USER,
      emailVerified: user.emailVerified,
    };

    const userTypeValue = user.userType || UserType.USER;

    if (userTypeValue === UserType.ORGANIZER) {
      baseResponse.organizationName = user.organizationName;
      baseResponse.phone = user.phone;
      baseResponse.isVerifiedOrganizer = user.isVerifiedOrganizer;
    } else if (userTypeValue === UserType.ADMIN) {
      baseResponse.adminLevel = user.adminLevel;
      baseResponse.permissions = user.permissions;
    }

    return baseResponse;
  }
}
