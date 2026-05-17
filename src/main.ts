import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { AlertLogger } from './logger/alert.logger';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const cookieParser = require('cookie-parser');

// BigInt → number in JSON responses (Telegram user IDs fit safely in Number)
(BigInt.prototype as any).toJSON = function () { return Number(this); };

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { logger: new AlertLogger() });

  app.use(cookieParser());

  // CORS only needed for the Telegram mini-app (different origin).
  // The web app is served from the same domain → no CORS needed for it.
  const origins = process.env.ALLOWED_ORIGINS?.split(',') ?? [
    'https://schema-miniapp.vercel.app',
    'https://diary-miniapp-sigma.vercel.app',
    'http://localhost:5173', // miniapp dev
  ];
  app.enableCors({
    origin: origins,
    methods: ['GET', 'POST', 'DELETE', 'PUT', 'PATCH'],
    allowedHeaders: ['Content-Type', 'x-telegram-init-data', 'Authorization', 'x-requested-with'],
    credentials: true,
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
