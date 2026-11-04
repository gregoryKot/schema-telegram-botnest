// Единая версия (docs/ONE_FRONTEND_PLAN.md, этапы 2 и 5): мини-апп `/app/*`
// уходит в кабинет сайта `/today`. Переход вечный и без флага: адрес `/app/`
// вшит в кнопки старых сообщений бота, в ярлыки, в адрес приложения в
// BotFather и в кабинет партнёра MAX.
import { MiddlewareConsumer, RequestMethod } from '@nestjs/common';
import type { Request, Response } from 'express';
import { SW_STUB_SOURCE } from './unified-frontend.sw-stub';

const APP_ROOT = '/app';
const SW_PATH = '/app/sw.js';
const TARGET = '/today';

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
  if ((req.method !== 'GET' && req.method !== 'HEAD') || !isAppPath(req.path)) {
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
  // 302, не 301: браузеры не кэшируют переход, его можно будет перенацелить.
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
