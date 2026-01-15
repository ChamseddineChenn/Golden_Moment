import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { Response } from 'express';
import { UsersService } from '../users/users.service';
import { LoginAttemptsService } from '../users/login-attempts.service';
import { SignupDto } from './dto/signup.dto';
import { LoginDto } from './dto/login.dto';
import { Role } from '../users/enums/role.enum';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private usersService: UsersService,
    private loginAttemptsService: LoginAttemptsService,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  async signup(signupDto: SignupDto, res: Response) {
    // Create user
    const user = await this.usersService.create({
      email: signupDto.email,
      password: signupDto.password,
    });

    // Generate tokens
    const { accessToken, refreshToken } = await this.generateTokens(
      user._id.toString(),
      user.email,
      user.role,
    );

    // Store refresh token hash
    await this.usersService.updateRefreshToken(user._id.toString(), refreshToken);

    // Set cookies
    this.setAuthCookies(res, accessToken, refreshToken);

    return {
      success: true,
      message: 'User registered successfully',
      user: {
        id: user._id.toString(),
        email: user.email,
        role: user.role,
      },
    };
  }

  async login(loginDto: LoginDto, ipAddress: string, userAgent: string, res: Response) {
    // Check if account is locked
    const isLocked = await this.loginAttemptsService.isAccountLocked(loginDto.email);
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
    const isPasswordValid = await bcrypt.compare(loginDto.password, user.password);

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
    await this.usersService.updateLastLogin(user._id.toString());

    // Generate tokens
    const { accessToken, refreshToken } = await this.generateTokens(
      user._id.toString(),
      user.email,
      user.role,
    );

    // Store refresh token hash
    await this.usersService.updateRefreshToken(user._id.toString(), refreshToken);

    // Set cookies
    this.setAuthCookies(res, accessToken, refreshToken);

    this.logger.log(`User ${user.email} logged in successfully`);

    return {
      success: true,
      message: 'Login successful',
      user: {
        id: user._id.toString(),
        email: user.email,
        role: user.role,
      },
    };
  }

  async refreshTokens(userId: string, email: string, role: string, res: Response) {
    // Generate new tokens
    const { accessToken, refreshToken } = await this.generateTokens(userId, email, role);

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

  private async generateTokens(userId: string, email: string, role: Role) {
    const payload = { sub: userId, email, role };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: this.configService.get<string>('jwt.accessSecret'),
        expiresIn: this.configService.get<string>('jwt.accessExpiration'),
      }),
      this.jwtService.signAsync(payload, {
        secret: this.configService.get<string>('jwt.refreshSecret'),
        expiresIn: this.configService.get<string>('jwt.refreshExpiration'),
      }),
    ]);

    return { accessToken, refreshToken };
  }

  private setAuthCookies(res: Response, accessToken: string, refreshToken: string) {
    const isProduction = this.configService.get<string>('NODE_ENV') === 'production';

    // Access token cookie (15 minutes)
    res.cookie('access_token', accessToken, {
      httpOnly: true, // Prevents JavaScript access
      secure: isProduction, // HTTPS only in production
      sameSite: 'strict', // CSRF protection
      maxAge: 15 * 60 * 1000, // 15 minutes
      path: '/',
    });

    // Refresh token cookie (7 days)
    res.cookie('refresh_token', refreshToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      path: '/',
    });
  }

  private clearAuthCookies(res: Response) {
    res.clearCookie('access_token', { path: '/' });
    res.clearCookie('refresh_token', { path: '/' });
  }

  async getCurrentUser(userId: string) {
    const user = await this.usersService.findById(userId);
    return {
      success: true,
      user: {
        id: user._id.toString(),
        email: user.email,
        role: user.role,
      },
    };
  }
}
