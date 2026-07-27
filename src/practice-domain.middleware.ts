import type { Request, Response } from 'express';

// Доменная стратегия (SEO): schemehappens.ru — единственный контент-хаб,
// kotlarewski.gr — сайт практики (конверсия, лёгкая индексация только
// главной), kotlarewski.ru — чистое зеркало и потому 301 на .gr, чтобы не
// плодить дубликаты и не делить ссылочный вес между тремя доменами.
const PRACTICE_HOST = 'kotlarewski.gr';
const REDIRECT_HOSTS = new Set(['kotlarewski.ru', 'www.kotlarewski.ru']);

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

/**
 * Функциональный middleware (без DI — чистая функция, тестируется напрямую):
 * - kotlarewski.ru → 301 на kotlarewski.gr с сохранением пути и query;
 * - kotlarewski.gr/sitemap.xml и /robots.txt → свои мини-версии
 *   (статики из webapp/public со ссылками schemehappens сюда не подходят).
 * Остальное пропускает дальше (SPA / ServeStatic).
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

  if (host === PRACTICE_HOST) {
    if (req.path === '/sitemap.xml') {
      res.type('application/xml').send(PRACTICE_SITEMAP);
      return;
    }
    if (req.path === '/robots.txt') {
      res.type('text/plain').send(PRACTICE_ROBOTS);
      return;
    }
  }

  next();
}
