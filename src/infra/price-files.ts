// llms.txt и прямой GET /index.html: файлы сборки, которые ServeStatic отдал бы
// с диска как есть, — с ценой визитки из админки (booking/landing-price.ts).
// Кэш — как у файла без хеша в имени: ревалидация, ETag по содержимому (res.send).
import { RequestMethod } from '@nestjs/common';
import type { Request, Response } from 'express';
import type { LandingText } from '../booking/landing-price';
import { REVALIDATE } from './static-cache';

/** Путь файла в корне сборки → Content-Type ответа. */
export const PRICE_FILES: Readonly<Record<string, string>> = {
  '/llms.txt': 'text/plain; charset=utf-8',
  '/index.html': 'text/html; charset=utf-8',
};

/** Маршруты для `forRoutes` в AppModule — тот же список. */
export const PRICE_FILE_ROUTES = Object.keys(PRICE_FILES).map((path) => ({
  path,
  method: RequestMethod.GET,
}));

/** `files` — содержимое по пути (прочитано при старте); файла нет — дальше, к ServeStatic. */
export function priceFilesMiddleware(
  files: Readonly<Record<string, string | null>>,
  landingText: LandingText,
) {
  return async (req: Request, res: Response, next: () => void) => {
    const type = PRICE_FILES[req.path];
    const text = files[req.path];
    if (!type || typeof text !== 'string') {
      next();
      return;
    }
    const body = await landingText(text);
    res.setHeader('Content-Type', type);
    res.setHeader('Cache-Control', REVALIDATE);
    res.send(body);
  };
}
