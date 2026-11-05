import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { configureApp } from './bootstrap';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bodyParser: false });
  await configureApp(app);
  const configService = app.get(ConfigService);
  const port = configService.get<number>('port') || 3002;
  await app.listen(port);
}

bootstrap();
