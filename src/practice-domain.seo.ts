// sitemap.xml и robots.txt визитки kotlarewski.gr (отдаёт их
// practice-domain.middleware.ts; вынесено из него по правилу №10).

export const practiceSitemap = (
  host: string,
): string => `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://${host}/</loc>
    <changefreq>monthly</changefreq>
    <priority>1.0</priority>
  </url>
</urlset>
`;

// Практике в индексе нужна только главная (брендовые запросы): статьи и
// приложение канонично живут на schemehappens.ru, /book — ссылка для клиентов.
// Админка закрыта явно: «Allow: /$» закрывает только корень, а не остальное
// (аудит 2026-10-11). /reviews, /subscribe, /donate пока открыты — индексировать
// ли их, решает владелец (docs/open/owner.md, «Что осталось открытым»).
export const practiceRobots = (host: string): string => `User-agent: *
Allow: /$
Disallow: /articles
Disallow: /privacy
Disallow: /offer
Disallow: /app
Disallow: /api
Disallow: /book
Disallow: /admin
Disallow: /booking-admin
Disallow: /articles-admin

Sitemap: https://${host}/sitemap.xml
`;
