// Общий бутстрап тестового приложения для e2e-смоука (TEST_COVERAGE_PLAN.md,
// этап 1 п.7). Собирает НАСТОЯЩИЙ AppModule (все контроллеры/гарды/пайпы —
// как в проде), подменяя только то, что не должно ходить в сеть/реальную БД:
//   - PrismaService → стейтфулый in-memory фейк (fake-prisma.ts)
//   - TELEGRAF_BOT   → no-op стаб (fake-bot.ts), чтобы не стучаться в Telegram
//
// Всё остальное — ValidationPipe, guard'ы, фильтры (configureApp, общий с
// src/main.ts) — то самое, что реально работает в проде: это и есть смысл e2e (юнит-тесты не могут поймать
// "guard не примонтирован" или "ValidationPipe не применён глобально").
//
// E2E_REAL_DB=1 (TEST_TRUST_PLAN.md, п.1) переключает PrismaService на
// настоящий Postgres (см. buildTestApp() ниже и build-real-db-test-app.ts) —
// для ownership-спеков, которые именно про фильтрацию по userId, там, где
// фейк расходился с реальностью.
import { INestApplication } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/prisma/prisma.service';
import { TELEGRAF_BOT } from '../../src/telegram/telegram.constants';
import { installBigIntJson } from '../../src/utils/bigint-json';
import { configureApp } from '../../src/infra/configure-app';
import { makeFakePrisma, FakePrisma } from './fake-prisma';
import { makeFakeBot } from './fake-bot';
import { buildRealDbTestApp } from './build-real-db-test-app';
import { stopCronJobs } from './stop-cron-jobs';

// BigInt в JSON-ответах — тот же установщик, что в src/main.ts (число для
// безопасного целого, строка для id ≥ 2^53). Без него любой ответ с
// полем-BigInt падает на JSON.stringify.
installBigIntJson();

export interface TestApp {
  app: INestApplication;
  prisma: FakePrisma;
}

export async function buildTestApp(): Promise<TestApp> {
  // Режим «реальная БД» (TEST_TRUST_PLAN.md, п.1): фейковая Prisma трижды
  // расходилась с настоящей на ЗЕЛЁНЫХ тестах (не понимала top-level OR,
  // не применяла @default из схемы, не поддерживала include) — ownership-
  // спеки (те самые, что про фильтрацию по userId) гоняются вторым прогоном
  // против реального Postgres джобы `migrations` (.github/workflows/ci.yml).
  // Сигнатура и возвращаемый тип не меняются ради существующих вызовов:
  // PrismaService структурно даёт те же методы (find*/create/upsert/
  // deleteMany), которыми пользуются спеки — `._rows`-специфичные места
  // (fake-prisma-only) переписаны на find*/deleteMany через
  // cleanup-fixtures.ts и точечные правки в самих спеках.
  if (process.env.E2E_REAL_DB === '1') {
    // FakePrisma — ReturnType<typeof makeFakePrisma>, который сам typed
    // `any` (see fake-prisma.ts) — присвоение PrismaService сюда не требует
    // приведения типа, но остаётся структурно совместимым по вызовам,
    // которые используют спеки.
    return await buildRealDbTestApp();
  }

  const prisma = makeFakePrisma();

  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  })
    .overrideProvider(PrismaService)
    .useValue(prisma)
    .overrideProvider(TELEGRAF_BOT)
    .useValue(makeFakeBot())
    .compile();

  // `bodyParser: false` — как в src/main.ts: свой парсер с BODY_LIMIT ставит
  // configureApp, штатный (100 КБ) не регистрируется вовсе.
  const app = moduleRef.createNestApplication<NestExpressApplication>({
    bodyParser: false,
  });
  // Та же обвязка, что в src/main.ts (фильтры, пайп, парсеры, helmet, CORS,
  // trust proxy) — одна функция, а не зеркало (src/infra/configure-app.ts).
  configureApp(app);

  await app.init();
  // Как в build-real-db-test-app.ts: расписание спеку не нужно, ему нужны
  // сами методы (гейт scripts/check-e2e-stop-cron.mjs).
  await stopCronJobs(app);
  return { app, prisma };
}
