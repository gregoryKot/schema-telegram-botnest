import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { AlertLogger } from './logger/alert.logger';
import { PrismaService } from './prisma/prisma.service';
import { announceStart } from './telegram/start-announce';
import { installBigIntJson } from './utils/bigint-json';
import { runClinicalLabelMigration } from './infra/self-check/clinical-labels-status';
import { logCapabilityReport } from './infra/capability-boot-log';
import { checkEnv } from './infra/env-check';
import { logEnvCheck } from './infra/env-check-boot-log';
import { configureApp } from './infra/configure-app';
import { registerUnhandledRejectionHandler } from './infra/unhandled-rejection';
import { registerUncaughtExceptionHandler } from './infra/uncaught-exception';

// BigInt в JSON: безопасное целое — числом, номер за пределами 2^53 (веб-id сегодня ниже) — строкой
// (src/utils/bigint-json.ts, аудит 2026-10 X-1).
installBigIntJson();

// Аудит 2026-10 (I6): до create — отказ и throw тоже в алерт (Logger → AlertLogger).
registerUnhandledRejectionHandler(new Logger('UnhandledRejection'));
registerUncaughtExceptionHandler(new Logger('UncaughtException'));

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: new AlertLogger(),
    // Штатный парсер Nest выключен намеренно (аудит 2026-07-20, L2): свой
    // ставит configureApp с лимитом BODY_LIMIT. Без этого флага потолок держался на
    // совпадении деталей чужой реализации — порядка `use`/`listen` и имён
    // слоёв, по которым Nest решает «парсер уже стоит». Разбор — в
    // src/infra/body-limit.ts.
    bodyParser: false,
  });

  // Вся HTTP-обвязка (trust proxy, редиректы, helmet/CSP, фильтры, пайп,
  // парсеры тела, CORS) — одна функция для main.ts и e2e-сборщиков.
  configureApp(app);

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  void announceStart(app); // DM о старте — только когда HTTP уже слушает

  // Реестр возможностей, зависящих от конфигурации (щит, волна 8): раз при
  // старте видно, что выключено и почему — мёртвая сигнализация (оба канала
  // admin-alert.ts) отдельной ERROR-строкой, остальное — info.
  logCapabilityReport(new Logger('CapabilityReport'));

  // Реестр env-переменных (щит, инциденты 2026-09-15/16): переменная
  // ПРИСУТСТВУЕТ, но неверна (чужой хост, опечатка, пустая ADMIN_EMAIL) — не
  // валит процесс (падение — крашлуп, хуже деградации), кроме уже
  // существующих исключений ENCRYPTION_KEY/DATABASE_URL, которые падают
  // раньше и отдельно (src/utils/crypto.ts, PrismaService).
  logEnvCheck(new Logger('EnvCheck'), checkEnv());

  // After listen (Prisma connected); idempotent, doesn't block startup.
  void runClinicalLabelMigration(
    app.get(PrismaService),
    new Logger('EncryptMigration'),
  );

  process.on('SIGTERM', () => void app.close());
  process.on('SIGINT', () => void app.close());
}

bootstrap().catch((err) => {
  new Logger('Bootstrap').error('Fatal error during bootstrap:', err);
  process.exit(1);
});
