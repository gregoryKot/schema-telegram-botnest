import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import type { Request, Response, NextFunction } from 'express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { AlertLogger } from './logger/alert.logger';
import { PrismaService } from './prisma/prisma.service';
import { announceStart } from './telegram/start-announce';
import { installBigIntJson } from './utils/bigint-json';
import { runClinicalLabelMigration } from './infra/self-check/clinical-labels-status';
import { logCapabilityReport } from './infra/capability-boot-log';
import { checkEnv } from './infra/env-check';
import { logEnvCheck } from './infra/env-check-boot-log';
import { canonicalRedirectTarget } from './infra/canonical-host';
import { clientIpSampler } from './infra/client-ip-sample';
import { TRUSTED_PROXY_HOPS } from './infra/trust-proxy';
import { installBodyParsers } from './infra/body-parsers';
import { helmetOptions } from './security/helmet-config';
import { permissionsPolicy } from './security/permissions-policy';
import { registerUnhandledRejectionHandler } from './infra/unhandled-rejection';
import { registerUncaughtExceptionHandler } from './infra/uncaught-exception';
import {
  PrismaExceptionFilter,
  GenericExceptionFilter,
} from './prisma/prisma-exception.filter';

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
    // стоит ниже с лимитом BODY_LIMIT. Без этого флага потолок держался на
    // совпадении деталей чужой реализации — порядка `use`/`listen` и имён
    // слоёв, по которым Nest решает «парсер уже стоит». Разбор — в
    // src/infra/body-limit.ts.
    bodyParser: false,
  });

  // Доверяем XFF ровно одному прокси: число и причина — в infra/trust-proxy.ts.
  // Выборка адресов для пробы clientIp ставится до редиректов, чтобы видеть и их.
  app.set('trust proxy', TRUSTED_PROXY_HOPS);
  app.use(clientIpSampler);

  // Domain + protocol redirects (production only) — host list lives in
  // src/infra/canonical-host.ts (правило «одна механика — один компонент»,
  // инцидент 2026-09-16: OAuth редиректил на хост, который эта же логика
  // редиректила обратно — цикл). Everything else (incl. kotlarewski.ru/.gr
  // aliases) → just force HTTPS via x-forwarded-proto (set by the proxy in front).
  if (process.env.NODE_ENV === 'production') {
    app.use((req: Request, res: Response, next: NextFunction) => {
      const host = (req.headers.host ?? '').toLowerCase();
      const target = canonicalRedirectTarget(host, req.url);
      if (target) return res.redirect(301, target);
      if (req.headers['x-forwarded-proto'] === 'http') {
        return res.redirect(301, `https://${host}${req.url}`);
      }
      next();
    });
  }

  app.use(cookieParser());
  app.use(helmet(helmetOptions()), permissionsPolicy());
  // Порядок важен: Nest берёт фильтры с конца, Prisma ловит раньше catch-all.
  app.useGlobalFilters(
    new GenericExceptionFilter(),
    new PrismaExceptionFilter(),
  );
  // Рантайм-валидация DTO (аудит 2026-07, 2г / правило №6 CLAUDE.md):
  // whitelist срезает недекорированные поля; для body без DTO-класса
  // (легаси inline-интерфейсы) пайп прозрачен — миграция инкрементальная.
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  // Единственные парсеры тела (штатный отключён выше): потолок 256 КБ — в
  // src/infra/body-limit.ts, форма разбирается только там, где её шлёт
  // внешняя система, — в src/infra/body-parsers.ts (login-CSRF, security#6).
  installBodyParsers(app);

  // CORS нужен только мини-аппу (другой origin): сайт на том же домене, localhost — dev.
  const isProd = process.env.NODE_ENV === 'production';
  const origins =
    process.env.ALLOWED_ORIGINS?.split(',') ??
    (isProd
      ? // Только канонический хост. Визитка (kotlarewski.gr) ходит в API
        // с собственного origin (VITE_API_URL пуст, fetch относительный),
        // CORS ей не нужен; credentials-CORS для алиаса — лишняя поверхность
        // (аудит 2026-10, I1; правило №19).
        ['https://schemehappens.ru']
      : [
          'https://schema-miniapp.vercel.app',
          'https://diary-miniapp-sigma.vercel.app',
          'http://localhost:5173',
        ]);
  app.enableCors({
    origin: origins,
    methods: ['GET', 'POST', 'DELETE', 'PUT', 'PATCH'],
    allowedHeaders: [
      'Content-Type',
      'x-telegram-init-data',
      'Authorization',
      'x-requested-with',
    ],
    credentials: true,
  });

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

  // Run after listen so PrismaService.onModuleInit has already connected.
  // Idempotent — skips rows already encrypted. Doesn't block startup.
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
