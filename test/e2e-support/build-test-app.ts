// Общий бутстрап тестового приложения для e2e-смоука (TEST_COVERAGE_PLAN.md,
// этап 1 п.7). Собирает НАСТОЯЩИЙ AppModule (все контроллеры/гарды/пайпы —
// как в проде), подменяя только то, что не должно ходить в сеть/реальную БД:
//   - PrismaService → стейтфулый in-memory фейк (fake-prisma.ts)
//   - TELEGRAF_BOT   → no-op стаб (fake-bot.ts), чтобы не стучаться в Telegram
//
// Всё остальное — ValidationPipe, guard'ы, фильтры — то самое, что реально
// работает в проде: это и есть смысл e2e (юнит-тесты не могут поймать
// "guard не примонтирован" или "ValidationPipe не применён глобально").
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { json, urlencoded } from 'express';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/prisma/prisma.service';
import { TELEGRAF_BOT } from '../../src/telegram/telegram.constants';
import {
  GenericExceptionFilter,
  PrismaExceptionFilter,
} from '../../src/prisma/prisma-exception.filter';
import { makeFakePrisma, FakePrisma } from './fake-prisma';
import { makeFakeBot } from './fake-bot';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const cookieParser = require('cookie-parser');

// BigInt → number в JSON-ответах — та же строка, что в src/main.ts. Без неё
// любой ответ с полем-BigInt (userId в некоторых эндпоинтах) падает на
// JSON.stringify (TypeError: Do not know how to serialize a BigInt).
(BigInt.prototype as any).toJSON = function () {
  return Number(this);
};

export interface TestApp {
  app: INestApplication;
  prisma: FakePrisma;
}

export async function buildTestApp(): Promise<TestApp> {
  const prisma = makeFakePrisma();

  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  })
    .overrideProvider(PrismaService)
    .useValue(prisma)
    .overrideProvider(TELEGRAF_BOT)
    .useValue(makeFakeBot())
    .compile();

  const app = moduleRef.createNestApplication();

  // ── ЗЕРКАЛО src/main.ts — держать синхронно при правках bootstrap() ────────
  // (helmet/CORS/redirect-middleware/ServeStatic намеренно опущены: они не
  // участвуют в проверяемых смоуком инвариантах — guard/DTO/ownership — и не
  // нужны для запросов supertest напрямую к handler'ам.)
  app.use(cookieParser());
  app.useGlobalFilters(
    new GenericExceptionFilter(),
    new PrismaExceptionFilter(),
  );
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.use(json({ limit: '256kb' }));
  app.use(urlencoded({ limit: '256kb', extended: true }));
  // ─────────────────────────────────────────────────────────────────────────

  await app.init();
  return { app, prisma };
}
