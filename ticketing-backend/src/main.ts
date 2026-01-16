import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors({
    origin: (origin, callback) => {
      // Allow all localhost URLs (any port)
      // Allow local network IP addresses (192.168.x.x, 10.x.x.x, etc)
      if (
        !origin ||
        origin.startsWith('http://localhost:') ||
        origin.startsWith('http://127.0.0.1:') ||
        /^http:\/\/(192\.168|10\.)\d+\.\d+\.\d+:\d+$/.test(origin)
      ) {
        callback(null, true);
      } else {
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
