import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { LoginAttemptsService } from './login-attempts.service';
import { User, UserSchema } from './schemas/user.schema';
import { Organizer, OrganizerSchema } from './schemas/organizer.schema';
import { Admin, AdminSchema } from './schemas/admin.schema';
import {
  LoginAttempt,
  LoginAttemptSchema,
} from './schemas/login-attempt.schema';
import { UserType } from './enums/user-type.enum';

@Module({
  imports: [
    MongooseModule.forFeatureAsync([
      {
        name: User.name,
        useFactory: () => {
          const schema = UserSchema;

          // Register discriminators
          schema.discriminator(UserType.ORGANIZER, OrganizerSchema);
          schema.discriminator(UserType.ADMIN, AdminSchema);

          return schema;
        },
      },
      { name: LoginAttempt.name, schema: LoginAttemptSchema },
    ]),
  ],
  controllers: [UsersController],
  providers: [UsersService, LoginAttemptsService],
  exports: [UsersService, LoginAttemptsService],
})
export class UsersModule {}
