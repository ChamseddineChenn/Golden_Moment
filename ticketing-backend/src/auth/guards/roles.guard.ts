import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserType } from '../../users/enums/user-type.enum';

export const USER_TYPES_KEY = 'userTypes';

interface RequestUser {
  userId: string;
  email: string;
  userType: string;
}

@Injectable()
export class UserTypeGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredTypes = this.reflector.getAllAndOverride<UserType[]>(
      USER_TYPES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredTypes) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user as RequestUser;

    if (!user) {
      throw new ForbiddenException('User not authenticated');
    }

    const hasType = requiredTypes.some((type) => user.userType === type);

    if (!hasType) {
      throw new ForbiddenException('Insufficient permissions');
    }

    return true;
  }
}
