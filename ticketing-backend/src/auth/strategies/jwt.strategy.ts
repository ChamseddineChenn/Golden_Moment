import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { UsersService } from '../../users/users.service';

export interface JwtPayload {
  [x: string]: string;
  sub: string;
  email: string;
  role: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    private configService: ConfigService,
    private usersService: UsersService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (request: Request) => {
          return request?.cookies?.access_token;
        },
      ]),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('jwt.accessSecret'),
    });
  }

  async validate(payload: JwtPayload) {
    console.log('[DEBUG-JWT-STRATEGY] Validating JWT:', {
      sub: payload.sub,
      email: payload.email,
      timestamp: new Date().toISOString(),
    });
    
    const user = await this.usersService.findById(payload.sub);

    if (!user || !user.isActive) {
      console.log('[DEBUG-JWT-STRATEGY] User not found or inactive');
      throw new UnauthorizedException('User not found or inactive');
    }

    console.log('[DEBUG-JWT-STRATEGY] JWT validation succeeded for user:', payload.sub);
    return {
      userId: payload.sub,
      email: payload.email,
      userType: payload.userType || 'User',
    };
  }
}
