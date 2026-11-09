// Тестовое приложение на РЕАЛЬНОМ Postgres — в отличие от build-test-app.ts
// (fake-prisma.ts, in-memory), здесь PrismaService НЕ подменяется: запросы
// реально идут в DATABASE_URL (CI-джоба `migrations` — единственная с
// поднятым Postgres). Нужен для HTTP-уровня read-after-write смоука
// (правило CLAUDE.md «Тесты»: сохранил ЧЕРЕЗ HTTP → прочитал ЧЕРЕЗ HTTP —
// юнит-тест сервиса не ловит guard/ValidationPipe/сериализацию на стыке).
// TELEGRAF_BOT по-прежнему фейковый (makeFakeBot) — бот не должен стучаться
// в Telegram при сборке AppModule.
import { INestApplication } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { AppModule } from '../../src/app.module';
import { configureApp } from '../../src/infra/configure-app';
import { PrismaService } from '../../src/prisma/prisma.service';
import { TELEGRAF_BOT } from '../../src/telegram/telegram.constants';
import { installBigIntJson } from '../../src/utils/bigint-json';
import { makeFakeBot } from './fake-bot';
import { withSiteStatic } from './e2e-site-static';
import { stopCronJobs } from './stop-cron-jobs';

// BigInt в JSON-ответах — тот же установщик, что в src/main.ts и
// build-test-app.ts.
installBigIntJson();

export interface RealDbTestApp {
  app: INestApplication;
  prisma: PrismaService;
}

/** siteDist — корень статики сайта (по умолчанию сборка-фикстура, e2e-site-static.ts). */
export async function buildRealDbTestApp(
  siteDist?: string,
): Promise<RealDbTestApp> {
  const moduleRef = await withSiteStatic(
    Test.createTestingModule({ imports: [AppModule] }),
    siteDist,
  )
    .overrideProvider(TELEGRAF_BOT)
    .useValue(makeFakeBot())
    .compile();

  const app = moduleRef.createNestApplication<NestExpressApplication>({
    bodyParser: false,
  });
  // Та же обвязка, что в src/main.ts и build-test-app.ts (src/infra/configure-app.ts).
  // Раньше здесь стояли свои строки — cookieParser, ValidationPipe, парсеры тела —
  // и не стояли фильтры исключений, trust proxy, helmet и CORS: прогон на живой
  // базе отвечал на ошибки не так, как прод (аудит 2026-10).
  configureApp(app);
  await app.init();
  // Настоящие @Cron тикают после init прямо посреди спека (stop-cron-jobs.ts);
  // гейт scripts/check-e2e-stop-cron.mjs.
  await stopCronJobs(app);
  return { app, prisma: app.get(PrismaService) };
}
