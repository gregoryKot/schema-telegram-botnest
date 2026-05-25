import { NestFactory } from '@nestjs/core';
import { json, urlencoded } from 'express';
import { AppModule } from './app.module';
import { AlertLogger } from './logger/alert.logger';
import { PrismaService } from './prisma/prisma.service';
import { migrateClinicalLabels } from './utils/encrypt-migration';
import { PrismaExceptionFilter, GenericExceptionFilter } from './prisma/prisma-exception.filter';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const cookieParser = require('cookie-parser');

// BigInt → number in JSON responses (Telegram user IDs fit safely in Number)
(BigInt.prototype as any).toJSON = function () { return Number(this); };

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { logger: new AlertLogger() });

  app.use(cookieParser());
  // Order matters: more-specific filter LAST (Nest applies them in reverse).
  // GenericExceptionFilter is the catch-all; PrismaExceptionFilter catches first.
  app.useGlobalFilters(new GenericExceptionFilter(), new PrismaExceptionFilter());
  // Cap request bodies. Largest legitimate payload is a YSQ progress update
  // (~116 ints + page) — well under 100 KB. Cap at 256 KB to leave room for
  // big text fields (letters, schema notes) while killing DoS via huge JSON.
  app.use(json({ limit: '256kb' }));
  app.use(urlencoded({ limit: '256kb', extended: true }));

  // CORS only needed for the Telegram mini-app (different origin).
  // The web app is served from the same domain → no CORS needed for it.
  // Production default is restrictive; localhost is dev-only.
  const isProd = process.env.NODE_ENV === 'production';
  const origins = process.env.ALLOWED_ORIGINS?.split(',') ?? (isProd
    ? ['https://schemalab.ru']
    : [
        'https://schema-miniapp.vercel.app',
        'https://diary-miniapp-sigma.vercel.app',
        'http://localhost:5173',
      ]);
  app.enableCors({
    origin: origins,
    methods: ['GET', 'POST', 'DELETE', 'PUT', 'PATCH'],
    allowedHeaders: ['Content-Type', 'x-telegram-init-data', 'Authorization', 'x-requested-with'],
    credentials: true,
  });

  const port = process.env.PORT ?? 3000;
  await app.listen(port);

  // Run after listen so PrismaService.onModuleInit has already connected.
  // Idempotent — skips rows already encrypted. Doesn't block startup.
  migrateClinicalLabels(app.get(PrismaService))
    .catch((e) => console.error('Clinical-label migration failed:', e));

  process.on('SIGTERM', () => app.close());
  process.on('SIGINT', () => app.close());
}

bootstrap().catch((err) => {
  console.error('Fatal error during bootstrap:', err);
  process.exit(1);
});
