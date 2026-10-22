// Единая версия (docs/ONE_FRONTEND_PLAN.md, этап 2): мини-апп `/app/*`
// уходит в кабинет сайта `/today`. Включается env-флагом UNIFIED_FRONTEND на
// этапе 5 — решение владельца; пока флаг выключен, middleware ничего не делает.
import { MiddlewareConsumer, RequestMethod } from '@nestjs/common';
import type { Request, Response } from 'express';
import { SW_STUB_SOURCE } from './unified-frontend.sw-stub';

const APP_ROOT = '/app';
const SW_PATH = '/app/sw.js';
const TARGET = '/today';

/** Единственное место чтения флага; env подменяется в тесте. */
export function isUnifiedFrontendOn(
  raw: string | undefined = process.env.UNIFIED_FRONTEND,
): boolean {
  // Этап 5 плана единой версии: включено по умолчанию. Выключает только явный
  // `0`/`false` в env — это откат, если вход в мессенджерах начнёт падать.
  const v = raw?.trim().toLowerCase();
  return v !== '0' && v !== 'false';
}

/** Путь целиком: `/app` или `/app/...` (не `/apple-touch-icon.png`). */
function isAppPath(path: string): boolean {
  return path === APP_ROOT || path.startsWith(`${APP_ROOT}/`);
}

function queryOf(originalUrl: string): string {
  const i = originalUrl.indexOf('?');
  return i === -1 ? '' : originalUrl.slice(i);
}

export function unifiedFrontendMiddleware(
  req: Request,
  res: Response,
  next: () => void,
): void {
  if (
    (req.method !== 'GET' && req.method !== 'HEAD') ||
    !isAppPath(req.path) ||
    !isUnifiedFrontendOn()
  ) {
    next();
    return;
  }
  if (req.path === SW_PATH) {
    res
      .status(200)
      .set({
        'Content-Type': 'application/javascript; charset=utf-8',
        'Cache-Control': 'no-store',
      })
      .send(SW_STUB_SOURCE);
    return;
  }
  // 302, не 301: решение обратимо, браузеры не должны кэшировать переход.
  // Query (?startapp=, ?section=, ?from= и любые другие) переносится целиком.
  // Фрагмент #tgWebAppData сервер не видит: при редиректе без фрагмента в
  // Location браузер сохраняет исходный фрагмент сам.
  res.redirect(302, `${TARGET}${queryOf(req.originalUrl)}`);
}

/** Регистрация после practiceDomainMiddleware и до ServeStaticModule. */
export function configureUnifiedFrontend(consumer: MiddlewareConsumer): void {
  consumer
    .apply(unifiedFrontendMiddleware)
    .forRoutes({ path: '{*path}', method: RequestMethod.ALL });
}
