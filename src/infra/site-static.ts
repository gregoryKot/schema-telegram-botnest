// Статика сайта (webapp/dist) за ServeStaticModule. Инцидент 2026-11-04: после
// деплоя /donate открылся без стилей. При выкладке Amvera шлёт запросы и в
// старый, и в новый контейнер, у каждого — только свои файлы с хешем в имени;
// промах по чужому /assets/index-<хеш>.css получал SPA-фолбэк (index.html,
// 200 text/html), и с nosniff от helmet браузер молча выбрасывал стиль.
//
// Инвариант: адрес файла сборки никогда не отвечает HTML. Есть файл — файл;
// нет — 404 с `Cache-Control: no-store`.
import { MiddlewareConsumer, RequestMethod } from '@nestjs/common';
import type { ServeStaticModuleOptions } from '@nestjs/serve-static';
import type { NextFunction, Request, Response } from 'express';
import type { ServerResponse } from 'http';
import { cacheControlFor } from './static-cache';

/** Каталоги сборки: сайт (`/assets/`) и игра (vite base `/game/`, Dockerfile
 *  кладёт game/dist в webapp/dist/game). Одна строка годится и для `exclude`
 *  serve-static, и для `forRoutes` Nest: `/x/{*path}` — всё под `/x/`, но не
 *  `/xfoo` (path-to-regexp 8, синтаксис из сообщения Nest о `/users/*`). */
export const BUILD_ASSET_ROUTES = [
  '/assets/{*path}',
  '/game/assets/{*path}',
] as const;

/** Один ServeStatic: сайт на `/`. SPA-фолбэк (renderPath) отдаёт index.html
 *  путям без файла; /api и каталоги сборки из фолбэка исключены. */
export function siteStaticOptions(rootPath: string): ServeStaticModuleOptions {
  return {
    rootPath,
    // Синтаксис path-to-regexp v6+: '/*path' (именованный wildcard), не голый '/*'.
    renderPath: '/*path',
    exclude: ['/api/{*path}', ...BUILD_ASSET_ROUTES],
    // Cache-Control по типу файла (immutable — только то, чьё имя меняется
    // вместе с содержимым; иначе max-age=0, замер 2026-08-22: 857мс).
    serveStaticOptions: {
      setHeaders: (res: ServerResponse, filePath: string) => {
        res.setHeader('Cache-Control', cacheControlFor(filePath));
      },
    },
  };
}

/** `no-store` заранее: попадание его перепишет, промах — унесёт в 404. */
export function buildAssetMissNoStore(
  _req: Request,
  res: Response,
  next: NextFunction,
): void {
  // Попадание: express.static (send) испускает `headers` до своих заголовков,
  // и setHeaders выше перезаписывает Cache-Control верным значением
  // (immutable / no-cache из cacheControlFor); свой send ставит, только если
  // заголовка нет. Промах: путь исключён из SPA-фолбэка, запрос падает в 404
  // Nest и сохраняет no-store — 404 одного контейнера посреди выкладки не
  // закэширует ни браузер, ни прокси.
  res.setHeader('Cache-Control', 'no-store');
  next();
}

/** После practiceDomainMiddleware; раньше serve-static — его маршруты встают
 *  в onModuleInit, позже middleware Nest. */
export function configureBuildAssets(consumer: MiddlewareConsumer): void {
  consumer.apply(buildAssetMissNoStore).forRoutes(
    ...BUILD_ASSET_ROUTES.map((path) => ({
      path,
      method: RequestMethod.ALL,
    })),
  );
}
