import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors({
    origin: (origin, callback) => {
      // Allow:
      // - No origin (same-origin requests)
      // - localhost:* (development)
      // - 127.0.0.1:* (development loopback)
      // - 192.168.x.x:* (private network)
      // - 10.x.x.x:* (private network)
      // - 172.16.x.x to 172.31.x.x:* (private network)
      if (
        !origin ||
        origin.startsWith('http://localhost:') ||
        origin.startsWith('http://127.0.0.1:') ||
        /^http:\/\/(192\.168|10|172\.(?:1[6-9]|2[0-9]|3[01]))\.(\d{1,3})\.(\d{1,3}):\d+$/.test(origin)
      ) {
        callback(null, true);
      } else {
        console.log(`[CORS] Rejected origin: ${origin}`);
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
  });
  const port = process.env.PORT ?? 3002;
  await app.listen(port, '0.0.0.0');
  console.log(`Backend server running on port ${port}`);
}
bootstrap();
