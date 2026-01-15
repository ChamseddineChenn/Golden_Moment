import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { EventsModule } from './events/events.module';
import { TicketsModule } from './tickets/tickets.module';
import { UploadModule } from './upload/upload.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { RolesGuard } from './auth/guards/roles.guard';
import configuration from './config/configuration';

@Module({
  imports: [
    // Configuration - Load environment variables and custom config
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
      load: [configuration], // Load the configuration file we created
    }),

    // Database - MongoDB connection with ConfigService
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        uri:
          configService.get<string>('database.uri') ||
          process.env.MONGODB_URI ||
          'mongodb://localhost:27017/ticketing-platform',
      }),
      inject: [ConfigService],
    }),

    // Rate Limiting - Protect against brute force attacks
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => [
        {
          ttl: configService.get<number>('throttle.ttl') || 60000, // 1 minute
          limit: configService.get<number>('throttle.limit') || 10, // 10 requests per minute
        },
      ],
      inject: [ConfigService],
    }),

    // Feature Modules
    EventsModule,
    TicketsModule,
    UploadModule,
    AuthModule,
    UsersModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,

    // Global Guards - Apply authentication and authorization to all routes
    // Routes must explicitly use @Public() decorator to bypass authentication
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard, // Protects all routes by default
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard, // Enforces role-based access control
    },
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard, // Rate limiting on all endpoints
    },
  ],
})
export class AppModule {}
