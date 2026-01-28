import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { json, raw } from 'express';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  // Middleware order matters: raw for webhooks, then json for regular requests
  app.use('/payments/webhook', raw({ type: 'application/json' }));
  app.use(json());

  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", 'data:', 'https:'],
        },
      },
      hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true,
      },
    }),
  );

  app.use(cookieParser());

  // Setup CORS with support for both development and production origins
  const allowedOrigins = [
    'http://localhost:3000', // Local development
    'http://localhost:3001', // Alternative local dev
    'https://golden-moment-inky.vercel.app', // Production frontend
  ];

  // Add any additional origins from environment variable
  const envOrigin = configService.get<string>('cors.origin');
  if (envOrigin && !allowedOrigins.includes(envOrigin)) {
    allowedOrigins.push(envOrigin);
  }

  app.enableCors({
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, curl, etc)
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('CORS not allowed'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    exposedHeaders: ['Set-Cookie'],
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      // Disabled forbidNonWhitelisted to allow nested objects with unknown properties
      // This is needed for ticketIds array which contains seat objects {sectionId, seatId}
      // that would otherwise be stripped by the whitelist
      forbidNonWhitelisted: false,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  const port = configService.get<number>('port');
  await app.listen(port);
}

bootstrap();
