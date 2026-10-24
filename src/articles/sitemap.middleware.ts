import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import type { Request, Response } from 'express';
import { ArticlesService } from './articles.service';
import {
  SITE_URL,
  esc,
  lastModified,
  type SeoArticleListItem,
} from './article-seo.render';

/**
 * sitemap.xml из БД: статьи приезжают сами, lastmod честный (позднее из
 * date/updatedAt). У статических страниц lastmod нет — настоящей даты мы не
 * знаем, а выдуманная хуже отсутствующей. Хост алиаса (kotlarewski.gr)
 * обслуживает practiceDomainMiddleware и сюда не доходит.
 */
export function buildSitemapXml(articles: SeoArticleListItem[]): string {
  const url = (loc: string, lastmod?: string) =>
    `  <url><loc>${esc(loc)}</loc>` +
    (lastmod ? `<lastmod>${lastmod}</lastmod>` : '') +
    `</url>`;
  const entries = [
    url(`${SITE_URL}/`),
    url(`${SITE_URL}/articles`),
    ...articles.map((a) =>
      url(
        `${SITE_URL}/articles/${a.slug}`,
        lastModified(a).toISOString().slice(0, 10),
      ),
    ),
    url(`${SITE_URL}/privacy`),
    url(`${SITE_URL}/offer`),
  ];
  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    `${entries.join('\n')}\n</urlset>\n`
  );
}

@Injectable()
export class SitemapMiddleware implements NestMiddleware {
  private readonly logger = new Logger(SitemapMiddleware.name);

  constructor(private readonly articles: ArticlesService) {}

  async use(req: Request, res: Response, next: () => void): Promise<void> {
    if (req.path.replace(/\/+$/, '') !== '/sitemap.xml') return next();

    let list: SeoArticleListItem[];
    try {
      list = await this.articles.list();
    } catch (err) {
      this.logger.warn(`sitemap unavailable: ${(err as Error).message}`);
      // Не next(): ServeStatic ответил бы краулеру index.html на неизвестный
      // путь. Повторяемый 503 лучше, чем HTML вместо XML.
      res
        .status(503)
        .type('text/plain')
        .send('sitemap temporarily unavailable');
      return;
    }

    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.send(buildSitemapXml(list));
  }
}
