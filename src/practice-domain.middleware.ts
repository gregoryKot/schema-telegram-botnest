import type { Request, Response } from 'express';
import { CANONICAL_HOST } from './infra/canonical-host';
import {
  PRACTICE_API_PREFIXES,
  PRACTICE_PAGES,
  PRACTICE_PAGE_PREFIXES,
} from './practice-domain.surface';
import { practicePageRedirect } from './practice-domain.redirects';
import { practiceRobots, practiceSitemap } from './practice-domain.seo';

// Практика (kotlarewski.gr) отдаёт только визитку: allow-list ниже, остальное 301
// (правило №19 — кука OAuth с алиаса не доходила до колбэка на каноническом хосте).
const PRACTICE_HOST = 'kotlarewski.gr';
/** Хосты-алиасы, которым статьи/главная переписывают canonical и og:url на
 *  собственный хост (единый allow-list: app.module, article-seo.middleware).
 *  kotlarewski.ru сюда не входит — он 301-ится на .gr. */
export const PRACTICE_ALIAS_HOSTS: ReadonlySet<string> = new Set([
  PRACTICE_HOST,
]);
const REDIRECT_HOSTS = new Set([
  'kotlarewski.ru',
  'www.kotlarewski.ru',
  'www.kotlarewski.gr',
]);

const PRACTICE_SITEMAP = practiceSitemap(PRACTICE_HOST);
const PRACTICE_ROBOTS = practiceRobots(PRACTICE_HOST);

// Allow-list визитки живёт в соседнем модуле, но доступен и отсюда (спеки).
export { PRACTICE_API_PREFIXES, PRACTICE_PAGES, PRACTICE_PAGE_PREFIXES };

// Хвостовой слэш не различает маршрут ('/donate/' === '/donate'); корень не трогаем.
const stripTrailingSlash = (path: string): string =>
  path.length > 1 && path.endsWith('/') ? path.slice(0, -1) : path;

// Статика визитки (`/assets/index.js`, иконки) — точка в последнем сегменте пути.
const isStaticAsset = (path: string): boolean =>
  path.slice(path.lastIndexOf('/') + 1).includes('.');

// Матч по сегменту: '/api/booking' пропускает '/api/booking/slots', не '/api/bookingx'.
const matchesPrefix = (path: string, prefixes: readonly string[]): boolean =>
  prefixes.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));

/**
 * Функциональный middleware (без DI — чистая функция, тестируется напрямую):
 * - kotlarewski.ru и www-варианты → 301 на kotlarewski.gr (путь+query);
 * - kotlarewski.gr отдаёт свои sitemap/robots, статику SPA и allow-list страниц/API
 *   визитки; переехавшая страница — 301 на новый путь, остальное — 301 на канонический хост;
 * - schemehappens.ru middleware не трогает.
 */
export function practiceDomainMiddleware(
  req: Request,
  res: Response,
  next: () => void,
): void {
  const host = req.hostname;

  if (REDIRECT_HOSTS.has(host)) {
    res.redirect(301, `https://${PRACTICE_HOST}${req.originalUrl}`);
    return;
  }

  if (host !== PRACTICE_HOST) {
    next();
    return;
  }

  const toCanonical = () =>
    res.redirect(301, `https://${CANONICAL_HOST}${req.originalUrl}`);
  const path = stripTrailingSlash(req.path);

  if (path === '/sitemap.xml') {
    res.type('application/xml').send(PRACTICE_SITEMAP);
    return;
  }
  if (path === '/robots.txt') {
    res.type('text/plain').send(PRACTICE_ROBOTS);
    return;
  }
  // Проба живости ходит на любой хост; 301 для неё — «упал».
  if (path === '/health') {
    next();
    return;
  }

  // Мини-апп всегда продуктовый — проверяем ДО статики, иначе
  // /app/index.html и /app/assets/*.js прошли бы как файлы визитки.
  if (path === '/app' || path.startsWith('/app/')) {
    toCanonical();
    return;
  }

  if (isStaticAsset(path)) {
    next();
    return;
  }

  if (path === '/api' || path.startsWith('/api/')) {
    if (matchesPrefix(path, PRACTICE_API_PREFIXES)) next();
    else toCanonical();
    return;
  }

  const moved = practicePageRedirect(path, req.originalUrl);
  if (moved) {
    res.redirect(301, moved);
    return;
  }

  if (
    PRACTICE_PAGES.includes(path) ||
    PRACTICE_PAGE_PREFIXES.some((prefix) => path.startsWith(prefix))
  ) {
    next();
    return;
  }

  toCanonical();
}
