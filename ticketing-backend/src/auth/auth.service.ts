import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import type { Response } from 'express';
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
    const user = await this.usersService.create({
      email: signupDto.email,
      password: signupDto.password,
    });

    const { accessToken, refreshToken } = await this.generateTokens(
      user.id,
      user.email,
      user.role,
    );

    await this.usersService.updateRefreshToken(user.id, refreshToken);

    this.setAuthCookies(res, accessToken, refreshToken);

    return {
      success: true,
      message: 'User registered successfully',
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
      },
    };
  }

  async login(
    loginDto: LoginDto,
    ipAddress: string,
    userAgent: string,
    res: Response,
  ) {
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

    const { accessToken, refreshToken } = await this.generateTokens(
      user.id,
      user.email,
      user.role,
    );

    await this.usersService.updateRefreshToken(user.id, refreshToken);

    this.setAuthCookies(res, accessToken, refreshToken);

    this.logger.log(`User ${user.email} logged in successfully`);

    return {
      success: true,
      message: 'Login successful',
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
      },
    };
  }

  async refreshTokens(
    userId: string,
    email: string,
    role: string,
    res: Response,
  ) {
    const roleEnum = role === 'admin' ? Role.ADMIN : Role.USER;

    const { accessToken, refreshToken } = await this.generateTokens(
      userId,
      email,
      roleEnum,
    );

    await this.usersService.updateRefreshToken(userId, refreshToken);

    this.setAuthCookies(res, accessToken, refreshToken);

    return {
      success: true,
      message: 'Tokens refreshed successfully',
    };
  }

  async logout(userId: string, res: Response) {
    await this.usersService.updateRefreshToken(userId, null);

    this.clearAuthCookies(res);

    return {
      success: true,
      message: 'Logged out successfully',
    };
  }

  private async generateTokens(userId: string, email: string, role: Role) {
    const payload = {
      sub: userId,
      email,
      role: role.toString(),
    };

    const accessSecret =
      this.configService.get<string>('jwt.accessSecret') || 'access-secret';
    const refreshSecret =
      this.configService.get<string>('jwt.refreshSecret') || 'refresh-secret';

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.sign(payload, {
        secret: accessSecret,
        expiresIn: '15m',
      }),
      this.jwtService.sign(payload, {
        secret: refreshSecret,
        expiresIn: '7d',
      }),
    ]);

    return { accessToken, refreshToken };
  }

  private setAuthCookies(
    res: Response,
    accessToken: string,
    refreshToken: string,
  ) {
    const isProduction =
      this.configService.get<string>('NODE_ENV') === 'production';

    res.cookie('access_token', accessToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'strict',
      maxAge: 15 * 60 * 1000,
      path: '/',
    });

    res.cookie('refresh_token', refreshToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000,
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
        id: user.id,
        email: user.email,
        role: user.role,
      },
    };
  }
}
