import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { LoginAttemptsService } from './login-attempts.service';
import { User, UserSchema } from './schemas/user.schema';
import { LoginAttempt, LoginAttemptSchema } from './schemas/login-attempt.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: LoginAttempt.name, schema: LoginAttemptSchema },
    ]),
  ],
  controllers: [UsersController],
  providers: [UsersService, LoginAttemptsService],
  exports: [UsersService, LoginAttemptsService],
})
export class UsersModule {}
