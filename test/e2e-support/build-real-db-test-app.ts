// Тестовое приложение на РЕАЛЬНОМ Postgres — в отличие от build-test-app.ts
// (fake-prisma.ts, in-memory), здесь PrismaService НЕ подменяется: запросы
// реально идут в DATABASE_URL (CI-джоба `migrations` — единственная с
// поднятым Postgres). Нужен для HTTP-уровня read-after-write смоука
// (правило CLAUDE.md «Тесты»: сохранил ЧЕРЕЗ HTTP → прочитал ЧЕРЕЗ HTTP —
// юнит-тест сервиса не ловит guard/ValidationPipe/сериализацию на стыке).
// TELEGRAF_BOT по-прежнему фейковый (makeFakeBot) — бот не должен стучаться
// в Telegram при сборке AppModule.
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import { json, urlencoded } from 'express';
import { AppModule } from '../../src/app.module';
import { BODY_LIMIT } from '../../src/infra/body-limit';
import { PrismaService } from '../../src/prisma/prisma.service';
import { TELEGRAF_BOT } from '../../src/telegram/telegram.constants';
import { installBigIntJson } from '../../src/utils/bigint-json';
import { makeFakeBot } from './fake-bot';

// BigInt в JSON-ответах — тот же установщик, что в src/main.ts и
// build-test-app.ts.
installBigIntJson();

export interface RealDbTestApp {
  app: INestApplication;
  prisma: PrismaService;
}

export async function buildRealDbTestApp(): Promise<RealDbTestApp> {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  })
    .overrideProvider(TELEGRAF_BOT)
    .useValue(makeFakeBot())
    .compile();

  const app = moduleRef.createNestApplication({ bodyParser: false });
  // cookieParser — то же зеркало src/main.ts, что и в build-test-app.ts. Без
  // него `req.cookies` пуст, и ЛЮБОЙ сценарий с refresh-кукой на живой базе
  // молча отвечал бы 401: не потому что сессия плоха, а потому что куку никто
  // не разобрал (найдено при переносе ротации на реальный Postgres,
  // 2026-08-28).
  app.use(cookieParser());
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  // Парсеры тела — то же зеркало src/main.ts (аудит 2026-07-20, L2). До этого
  // прогон на живой базе парсеры не ставил вообще и жил со штатным потолком
  // Nest в 100 КБ: тело на 150 КБ проходило в фейковом прогоне и падало в
  // настоящем. Ровно тот класс расхождения фейка с реальностью, ради которого
  // второй прогон и заведён.
  app.use(json({ limit: BODY_LIMIT }));
  app.use(urlencoded({ limit: BODY_LIMIT, extended: true }));
  await app.init();
  return { app, prisma: app.get(PrismaService) };
}
