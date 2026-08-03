// Общий бутстрап тестового приложения для e2e-смоука (TEST_COVERAGE_PLAN.md,
// этап 1 п.7). Собирает НАСТОЯЩИЙ AppModule (все контроллеры/гарды/пайпы —
// как в проде), подменяя только то, что не должно ходить в сеть/реальную БД:
//   - PrismaService → стейтфулый in-memory фейк (fake-prisma.ts)
//   - TELEGRAF_BOT   → no-op стаб (fake-bot.ts), чтобы не стучаться в Telegram
//
// Всё остальное — ValidationPipe, guard'ы, фильтры — то самое, что реально
// работает в проде: это и есть смысл e2e (юнит-тесты не могут поймать
// "guard не примонтирован" или "ValidationPipe не применён глобально").
//
// E2E_REAL_DB=1 (TEST_TRUST_PLAN.md, п.1) переключает PrismaService на
// настоящий Postgres (см. buildTestApp() ниже и build-real-db-test-app.ts) —
// для ownership-спеков, которые именно про фильтрацию по userId, там, где
// фейк расходился с реальностью.
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
import { buildRealDbTestApp } from './build-real-db-test-app';
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
