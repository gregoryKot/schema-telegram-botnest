import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { AlertLogger } from './logger/alert.logger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { logger: new AlertLogger() });

  const origins = process.env.ALLOWED_ORIGINS?.split(',') ?? ['https://schema-miniapp.vercel.app', 'http://localhost:5173'];
  app.enableCors({
    origin: origins,
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type', 'x-telegram-init-data'],
  });

  const port = process.env.PORT ?? 3000;
  await app.listen(port);

  process.on('SIGTERM', () => app.close());
  process.on('SIGINT', () => app.close());
}

bootstrap().catch((err) => {
  console.error('Fatal error during bootstrap:', err);
  process.exit(1);
});
