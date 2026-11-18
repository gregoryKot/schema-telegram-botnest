import type { Request, Response } from 'express';
import type { LandingText } from '../booking/landing-price';
import { SPA_ROOT } from '../infra/spa-root';
import { REVALIDATE } from '../infra/static-cache';
import { PRACTICE_ALIAS_HOSTS } from '../practice-domain.middleware';
import { buildHomeBody } from './home-seo.render';

// Главная schemehappens.ru для робота без JS (GEO.md, «Главная для робота
// пуста»): index.html с текстом продуктового лендинга внутри #root — тот же
// приём, что ArticleSeoMiddleware у статей.
//
// Какая главная где (правило №19): на schemehappens.ru `/` — продуктовый
// лендинг (ProductLandingPage), на kotlarewski.gr `/` — визитка практики
// (LandingPage), её отдаёт practiceIndexMiddleware раньше этого middleware
// со своим canonical. Визитку здесь не трогаем и на алиасе отдаём дальше:
// продуктовый текст в #root визитки был бы чужой страницей.
//
// HTML с текстом собирается при старте, цена визитки — при отдаче. Кэш тот
// же, что у index.html из ServeStatic: `public, no-cache` (ревалидация каждый
// раз — после деплоя у страницы другие хеши бандла), ETag и 304 ставит
// res.send Express по содержимому.

/** index.html с текстом лендинга в #root вместо экрана загрузки; null — файла нет или
 *  в #root чужое (сборка поменяла разметку — отдаём как есть, без вложения). */
export function homeSeoHtml(html: string | null): string | null {
  if (!html || !SPA_ROOT.test(html)) return null;
  return html.replace(
    SPA_ROOT,
    () => `<div id="root">${buildHomeBody()}</div>`,
  );
}

/** GET `/` на хосте приложения → index.html с текстом лендинга; любой другой
 *  путь или хост-алиас — дальше (practiceIndexMiddleware, ServeStatic). */
export function homeSeoMiddleware(
  html: string | null,
  landingText: LandingText,
  aliasHosts: ReadonlySet<string> = PRACTICE_ALIAS_HOSTS,
) {
  const out = homeSeoHtml(html);
  return async (req: Request, res: Response, next: () => void) => {
    if (!out || req.path !== '/' || aliasHosts.has(req.hostname)) {
      next();
      return;
    }
    const body = await landingText(out);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', REVALIDATE);
    res.send(body);
  };
}
