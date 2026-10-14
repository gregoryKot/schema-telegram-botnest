import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import type { Request, Response, NextFunction } from 'express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { AlertLogger } from './logger/alert.logger';
import { PrismaService } from './prisma/prisma.service';
import { installBigIntJson } from './utils/bigint-json';
import { migrateClinicalLabels } from './utils/encrypt-migration';
import { logCapabilityReport } from './infra/capability-boot-log';
import { checkEnv } from './infra/env-check';
import { logEnvCheck } from './infra/env-check-boot-log';
import { canonicalRedirectTarget } from './infra/canonical-host';
import { installBodyParsers } from './infra/body-parsers';
import { helmetOptions } from './security/helmet-config';
import { registerUnhandledRejectionHandler } from './infra/unhandled-rejection';
import {
  PrismaExceptionFilter,
  GenericExceptionFilter,
} from './prisma/prisma-exception.filter';

// BigInt в JSON: безопасное целое — числом, веб-id (≥ 1e18) — строкой
// (src/utils/bigint-json.ts, аудит 2026-10 X-1).
installBigIntJson();

// Аудит 2026-10 (I6): до создания приложения — отказ внутри bootstrap тоже
// должен дойти до алерта. Logger статический: после NestFactory.create он
// пишет через AlertLogger.
registerUnhandledRejectionHandler(new Logger('UnhandledRejection'));

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

  // M5 (аудит 2026-08): за Express стоит один reverse-proxy Amvera. Без этого
  // Express игнорирует X-Forwarded-For, и req.ip отражает ПРОКСИ, а не клиента —
  // все IP-бакеты троттлинга (правило №5), WebSession.ipAddress и IP в
  // аудит-логах схлопываются в один. Доверяем ровно одному хопу (не `true` —
  // иначе клиент подделает XFF); x-forwarded-proto ниже уже трактуется как
  // доказательство прокси, так что доверие к XFF от того же хопа консистентно.
  app.set('trust proxy', 1);

  // Domain + protocol redirects (production only) — host list lives in
  // src/infra/canonical-host.ts (правило «одна механика — один компонент»,
  // инцидент 2026-09-16: OAuth редиректил на хост, который эта же логика
  // редиректила обратно — цикл). Everything else (incl. kotlarewski.ru/.gr
  // aliases) → just force HTTPS via x-forwarded-proto (Amvera's proxy).
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
  app.use(helmet(helmetOptions()));
  // Order matters: more-specific filter LAST (Nest applies them in reverse).
  // GenericExceptionFilter is the catch-all; PrismaExceptionFilter catches first.
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

  // CORS only needed for the Telegram mini-app (different origin).
  // The web app is served from the same domain → no CORS needed for it.
  // Production default is restrictive; localhost is dev-only.
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
  migrateClinicalLabels(app.get(PrismaService)).catch((e) =>
    console.error('Clinical-label migration failed:', e),
  );

  process.on('SIGTERM', () => void app.close());
  process.on('SIGINT', () => void app.close());
}

bootstrap().catch((err) => {
  console.error('Fatal error during bootstrap:', err);
  process.exit(1);
});
