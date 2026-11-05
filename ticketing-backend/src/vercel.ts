import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import express from 'express';
import { AppModule } from './app.module';
import { configureApp } from './bootstrap';

const server = express();
let ready: Promise<express.Express> | null = null;

async function bootstrapServer(): Promise<express.Express> {
  const app = await NestFactory.create(AppModule, new ExpressAdapter(server), {
    bodyParser: false,
  });
  await configureApp(app);
  await app.init();
  return server;
}

export default async function handler(
  req: express.Request,
  res: express.Response,
) {
  if (!ready) {
    ready = bootstrapServer().catch((error) => {
      ready = null;
      throw error;
    });
  }
  const expressApp = await ready;
  return expressApp(req, res);
}
