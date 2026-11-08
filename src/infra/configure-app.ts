// Общая HTTP-обвязка приложения. Её зовут src/main.ts и оба e2e-сборщика
// (test/e2e-support/build-test-app.ts, build-real-db-test-app.ts) — одна
// функция вместо «зеркал» с ручной синхронизацией. Зеркала разъехались (аудит
// 2026-10, «Зеркала e2e-бутстрапа расходятся с main.ts»): прогон на живом
// Postgres шёл без фильтров исключений, ни один сборщик не ставил trust proxy,
// helmet и CORS, а то, что main.ts ставит helmet ровно один раз и с настоящим
// конфигом, держал только регэксп по тексту. Теперь слои проверяются запросом
// через эту функцию (src/security/hardening.invariants.spec.ts), а что её
// зовут все три бутстрапа — сверкой там же.
//
// Порядок слоёв несущий: выборка адресов и счётчик роботов — до редиректов,
// чтобы видеть и их; фильтры Nest берёт с конца — Prisma ловит раньше catch-all.
import { ValidationPipe } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import type { NextFunction, Request, Response } from 'express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { crawlerHitCounter } from '../analytics/crawler-hits';
import {
  GenericExceptionFilter,
  PrismaExceptionFilter,
} from '../prisma/prisma-exception.filter';
import { helmetOptions } from '../security/helmet-config';
import { permissionsPolicy } from '../security/permissions-policy';
import { apiNoStore } from './api-no-store';
import { installBodyParsers } from './body-parsers';
import { canonicalRedirectTarget } from './canonical-host';
import { clientIpSampler } from './client-ip-sample';
import { corsOptions } from './cors-options';
import { TRUSTED_PROXY_HOPS } from './trust-proxy';

/**
 * Хостовый и HTTPS-редирект (только прод). Список хостов — в
 * src/infra/canonical-host.ts (инцидент 2026-09-16: OAuth редиректил на хост,
 * который эта же логика редиректила обратно — цикл). Остальное (алиасы
 * визитки) — только HTTPS по x-forwarded-proto от прокси перед нами.
 */
function canonicalRedirect(req: Request, res: Response, next: NextFunction) {
  const host = (req.headers.host ?? '').toLowerCase();
  const target = canonicalRedirectTarget(host, req.url);
  if (target) return res.redirect(301, target);
  if (req.headers['x-forwarded-proto'] === 'http') {
    return res.redirect(301, `https://${host}${req.url}`);
  }
  next();
}

export function configureApp(app: NestExpressApplication): void {
  // Доверяем XFF ровно одному прокси: число и причина — в trust-proxy.ts.
  app.set('trust proxy', TRUSTED_PROXY_HOPS);
  app.use(clientIpSampler); // выборка адресов для пробы clientIp
  app.use(crawlerHitCounter); // заходы роботов нейросетей
  if (process.env.NODE_ENV === 'production') app.use(canonicalRedirect);

  app.use(cookieParser());
  app.use(helmet(helmetOptions()), permissionsPolicy(), apiNoStore);
  app.useGlobalFilters(
    new GenericExceptionFilter(),
    new PrismaExceptionFilter(),
  );
  // Рантайм-валидация DTO (аудит 2026-07, 2г / правило №6): whitelist срезает
  // недекорированные поля; для body без DTO-класса пайп прозрачен.
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  // Единственные парсеры тела (штатный Nest отключён в main.ts и сборщиках —
  // `bodyParser: false`): потолок — src/infra/body-limit.ts, форма — только
  // на путях внешних систем, src/infra/body-parsers.ts (login-CSRF, security#6).
  installBodyParsers(app);
  app.enableCors(corsOptions());
}
