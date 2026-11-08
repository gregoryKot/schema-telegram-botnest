// Страницы визитки (kotlarewski.gr) отдают тот же webapp/dist/index.html, что и
// schemehappens.ru, но с карточкой ссылки визитки (practice-preview.ts): в
// файле карточка продукта. Страницы в поиске (PRACTICE_INDEXED_PAGES: главная
// и /reviews) получают ещё свои canonical и og:url — иначе поисковик и
// Telegram склеивают визитку с продуктом, а /reviews — с главной. JSON-LD
// указывает на kotlarewski.gr уже в самом файле.
import { RequestMethod } from '@nestjs/common';
import type { Request, Response } from 'express';
import { REVALIDATE } from './infra/static-cache';
import { PRACTICE_PAGES } from './practice-domain.surface';
import { PRACTICE_INDEXED_PAGES } from './practice-domain.seo';
import { practicePreviewHtml } from './practice-preview';

const PRODUCT_ROOT = 'https://schemehappens.ru/';

/** Страницы визитки, которые отдаёт этот middleware. `/articles` — у
 *  ArticleSeoMiddleware (список статей из БД), он же ставит карточку визитки. */
export const PRACTICE_PREVIEW_PAGES: readonly string[] = PRACTICE_PAGES.filter(
  (path) => path !== '/articles',
);

/** Маршруты для `forRoutes` в AppModule — тот же список. */
export const PRACTICE_PREVIEW_ROUTES = PRACTICE_PREVIEW_PAGES.map((path) => ({
  path,
  method: RequestMethod.GET,
}));

export function practiceIndexHtml(
  html: string,
  domain: string,
  path = '/',
): string {
  const own = `https://${domain}${path}`;
  return html
    .replace(`href="${PRODUCT_ROOT}"`, `href="${own}"`)
    .replace(`content="${PRODUCT_ROOT}"`, `content="${own}"`);
}

/** Страница визитки целиком: карточка визитки, а странице из поиска — ещё
 *  свои canonical и og:url. Остальные (/book, /donate…) поисковику закрыты
 *  или не нужны, их canonical не трогаем. */
export function practicePageHtml(
  html: string,
  domain: string,
  path: string,
): string {
  const preview = practicePreviewHtml(html);
  return PRACTICE_INDEXED_PAGES.includes(path)
    ? practiceIndexHtml(preview, domain, path)
    : preview;
}

/** GET страницы визитки на хосте-алиасе — index.html с её карточкой; любой
 *  другой хост или путь — дальше, к ServeStatic. Кэш — как у index.html из
 *  ServeStatic: ревалидация каждый раз, у сборки после деплоя другие хеши. */
export function practiceIndexMiddleware(
  html: string | null,
  aliasHosts: ReadonlySet<string>,
) {
  return (req: Request, res: Response, next: () => void): void => {
    const path = req.path.length > 1 ? req.path.replace(/\/+$/, '') : req.path;
    if (
      !html ||
      !aliasHosts.has(req.hostname) ||
      !PRACTICE_PREVIEW_PAGES.includes(path)
    ) {
      next();
      return;
    }
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', REVALIDATE);
    res.send(practicePageHtml(html, req.hostname, path));
  };
}
