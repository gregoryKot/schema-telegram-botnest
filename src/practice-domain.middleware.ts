import type { Request, Response } from 'express';
import { CANONICAL_HOST } from './infra/canonical-host';

// Доменная стратегия (2026-09-08 / 2026-09-16): практика (kotlarewski.gr)
// теперь отдаёт только визитку. Раньше алиас отдавал весь SPA и API: кука
// oauth_state ставилась на хосте алиаса, а колбэк OAuth приходил на
// канонический хост — вход падал; последующий редирект-фикс без сужения
// поверхности зациклился. Решение ниже — allow-list визитки, остальное 301.
const PRACTICE_HOST = 'kotlarewski.gr';
const REDIRECT_HOSTS = new Set([
  'kotlarewski.ru',
  'www.kotlarewski.ru',
  'www.kotlarewski.gr',
]);

const PRACTICE_SITEMAP = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://${PRACTICE_HOST}/</loc>
    <changefreq>monthly</changefreq>
    <priority>1.0</priority>
  </url>
</urlset>
`;

// Практике не нужны в индексе служебные и продуктовые маршруты — только
// главная (брендовые запросы). Статьи и приложение канонично живут на
// schemehappens.ru.
const PRACTICE_ROBOTS = `User-agent: *
Allow: /$
Disallow: /articles
Disallow: /privacy
Disallow: /offer
Disallow: /app
Disallow: /api

Sitemap: https://${PRACTICE_HOST}/sitemap.xml
`;

/** Страницы SPA, которые визитка рендерит сама — зеркало `personalRoutes`
 *  в webapp/src/App.tsx (тест-сверка в practice-domain.middleware.spec.ts). */
export const PRACTICE_PAGES: readonly string[] = [
  '/',
  '/articles',
  '/reviews',
  '/admin',
  '/booking-admin',
  '/articles-admin',
  '/booking/paid',
  '/subscribe',
  '/donate',
  '/privacy',
  '/offer',
];
/** Префиксы страниц с параметром (`/articles/:slug`). */
export const PRACTICE_PAGE_PREFIXES: readonly string[] = ['/articles/'];

/** GET-ручки API, которые зовут страницы визитки. Каждая — с причиной. */
export const PRACTICE_API_PREFIXES: readonly string[] = [
  '/api/booking', // запись на консультацию: options, slots, by-token, admin/*
  '/api/subscription', // подписка: options, by-token
  '/api/donation', // донат (страница /donate)
  '/api/site-content', // фото/бегущая строка лендинга + admin/*
  '/api/articles', // статьи и их админка
  '/api/healthy-adult', // админка фраз канала (AdminPage)
  '/api/client-errors', // отчёт о сбое формы брони (bookingFailure.ts), правило №14
];

// Хвостовой слэш не различает маршрут ('/donate/' === '/donate'); корень не трогаем.
const stripTrailingSlash = (path: string): string =>
  path.length > 1 && path.endsWith('/') ? path.slice(0, -1) : path;

// Бандл SPA и иконки визитки (`/assets/index.js`, `/favicon-personal-32.png`)
// узнаются по точке в последнем сегменте пути.
const isStaticAsset = (path: string): boolean =>
  path.slice(path.lastIndexOf('/') + 1).includes('.');

// Матч по сегменту пути, а не по подстроке: '/api/booking' пропускает
// '/api/booking/slots', но не '/api/bookingx'.
const matchesPrefix = (path: string, prefixes: readonly string[]): boolean =>
  prefixes.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));

/**
 * Функциональный middleware (без DI — чистая функция, тестируется напрямую):
 * - kotlarewski.ru и www-варианты → 301 на kotlarewski.gr (путь+query);
 * - kotlarewski.gr отдаёт свои sitemap/robots, статику SPA визитки и
 *   allow-list страниц/API визитки (PRACTICE_PAGES/PRACTICE_API_PREFIXES);
 *   всё остальное — 301 на канонический хост (путь+query сохраняются);
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

  if (
    PRACTICE_PAGES.includes(path) ||
    PRACTICE_PAGE_PREFIXES.some((prefix) => path.startsWith(prefix))
  ) {
    next();
    return;
  }

  toCanonical();
}
