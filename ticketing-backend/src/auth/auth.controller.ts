import {
  Controller,
  Post,
  Get,
  Body,
  Res,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import type { Response, Request } from 'express';
import { AuthService, AuthResponse, SimpleResponse } from './auth.service';
import { SignupDto } from './dto/signup.dto';
import { SignupOrganizerDto } from './dto/signup-organizer.dto';
import { LoginDto } from './dto/login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { ResendVerificationDto } from './dto/resend-verification.dto';
import { Public } from './decorators/public.decorator';
import { JwtRefreshGuard } from './guards/jwt-refresh.guard';
import { GetCurrentUser } from './decorators/get-current-user.decorator';
import { Throttle } from '@nestjs/throttler';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('signup')
  @HttpCode(HttpStatus.CREATED)
  async signup(
    @Body() signupDto: SignupDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponse> {
    return this.authService.signup(signupDto, res);
  }

  @Public()
  @Post('signup/organizer')
  @HttpCode(HttpStatus.CREATED)
  async signupOrganizer(
    @Body() signupOrganizerDto: SignupOrganizerDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponse> {
    return this.authService.signupOrganizer(signupOrganizerDto, res);
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() loginDto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponse> {
    const ipAddress = req.ip || req.socket.remoteAddress || 'unknown';
    const userAgent = req.headers['user-agent'] || 'unknown';

    return this.authService.login(loginDto, ipAddress, userAgent, res);
  }

  @Public()
  @Post('refresh')
  @UseGuards(JwtRefreshGuard)
  @HttpCode(HttpStatus.OK)
  async refreshTokens(
    @GetCurrentUser('userId') userId: string,
    @GetCurrentUser('email') email: string,
    @GetCurrentUser('userType') userType: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<SimpleResponse> {
    return this.authService.refreshTokens(userId, email, userType, res);
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(
    @GetCurrentUser('userId') userId: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<SimpleResponse> {
    return this.authService.logout(userId, res);
  }

  @Throttle({ default: { limit: 100, ttl: 60000 } })
  @Get('me')
  async getCurrentUser(@GetCurrentUser('userId') userId: string) {
    return this.authService.getCurrentUser(userId);
  }

  @Public()
  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  async verifyEmail(
    @Body() verifyEmailDto: VerifyEmailDto,
  ): Promise<AuthResponse> {
    return this.authService.verifyEmail(verifyEmailDto);
  }

  @Public()
  @Post('resend-verification')
  @HttpCode(HttpStatus.OK)
  async resendVerification(
    @Body() resendVerificationDto: ResendVerificationDto,
  ): Promise<SimpleResponse> {
    return this.authService.resendVerification(resendVerificationDto);
  }

  @Public()
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  async forgotPassword(
    @Body() forgotPasswordDto: ForgotPasswordDto,
  ): Promise<SimpleResponse> {
    return this.authService.forgotPassword(forgotPasswordDto);
  }

  @Public()
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  async resetPassword(
    @Body() resetPasswordDto: ResetPasswordDto,
  ): Promise<SimpleResponse> {
    return this.authService.resetPassword(resetPasswordDto);
  }
}
