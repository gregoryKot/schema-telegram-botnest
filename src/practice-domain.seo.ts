// sitemap.xml и robots.txt визитки kotlarewski.gr (отдаёт practice-domain.middleware.ts).
/** Страницы визитки в поиске — решение владельца 2026-10-24: главная (брендовые
 *  запросы) и /reviews («Почему здесь нет отзывов» отвечает на запрос «… отзывы»).
 *  Остальное закрыто: статьи и приложение живут на schemehappens.ru, /subscribe и /donate — копии продукта.
 *  Каждая страница визитки классифицирована в practice-domain.seo.spec.ts. */
import { LINKS_PAGE_ALIASES } from './practice-domain.redirects';

export const PRACTICE_INDEXED_PAGES: readonly string[] = ['/', '/reviews'];

export const practiceSitemap = (host: string): string =>
  `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${PRACTICE_INDEXED_PAGES.map((p) => `  <url><loc>https://${host}${p}</loc></url>`).join('\n')}
</urlset>
`;

// «Allow: /$» открывает только корень; всё, что не закрыто явно, открыто — поэтому
// закрытое перечислено поимённо (аудит 2026-10-11: админка без Disallow была открыта).
export const practiceRobots = (host: string): string => `User-agent: *
Allow: /$
Disallow: /articles
Disallow: /privacy
Disallow: /offer
Disallow: /subscribe
Disallow: /donate
Disallow: /app
Disallow: /api
Disallow: /book
Disallow: /admin
Disallow: /booking-admin
Disallow: /articles-admin
Disallow: /privet
${LINKS_PAGE_ALIASES.map((p) => `Disallow: ${p}`).join('\n')}

Sitemap: https://${host}/sitemap.xml
`;
