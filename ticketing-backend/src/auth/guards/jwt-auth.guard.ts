import {
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private reflector: Reflector) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      console.log('[DEBUG-JWT-GUARD] Public endpoint, skipping auth');
      return true;
    }

    const request = context.switchToHttp().getRequest();
    console.log('[DEBUG-JWT-GUARD] Checking auth for:', {
      path: request.path,
      method: request.method,
      hasAccessToken: !!request?.cookies?.access_token,
      cookies: request?.cookies,
      timestamp: new Date().toISOString(),
    });

    const result = (await super.canActivate(context)) as boolean;
    console.log('[DEBUG-JWT-GUARD] Auth check result:', result);
    return result;
  }

  handleRequest<TUser = any>(
    err: any,
    user: any,
    _info: any,
    context: ExecutionContext,
  ): TUser {
    // If authentication fails, clear the cookies
    if (err || !user) {
      const response = context.switchToHttp().getResponse();

      // Clear invalid cookies
      response.clearCookie('access_token', { path: '/' });
      response.clearCookie('refresh_token', { path: '/' });

      throw err || new UnauthorizedException('Authentication required');
    }
    return user;
  }
}
