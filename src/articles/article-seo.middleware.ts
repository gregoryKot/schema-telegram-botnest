import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import type { Request, Response } from 'express';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { ArticlesService } from './articles.service';
import {
  SITE_URL,
  buildArticleBody,
  buildArticleJsonLd,
  buildArticlesListBody,
  injectSeo,
  type SeoPage,
} from './article-seo.render';
import { requestHost } from '../infra/request-host';
import { PRACTICE_ALIAS_HOSTS } from '../practice-domain.middleware';

const LIST_TITLE = 'Статьи о схема-терапии – Григорий Котляревский';
const LIST_DESCRIPTION =
  'Статьи о схема-терапии: что это за метод, кому подходит, схемы и режимы, когда стоит обратиться.';

/**
 * Server-side SEO injection for /articles and /articles/:slug.
 *
 * The site is a client-rendered SPA: without this, every /articles/* URL is
 * served the same static index.html with an identical <title>/description, so
 * search engines (especially Yandex, which barely runs JS) and AI crawlers see
 * the article pages as empty duplicates of the homepage and never rank them.
 *
 * This middleware runs BEFORE ServeStatic. For an article URL it fetches the
 * article from the DB and injects a real per-page <title>, meta description,
 * canonical, Open Graph tags, an Article JSON-LD block, AND the article text
 * into #root — so a crawler receives fully-formed HTML. The list page gets the
 * same treatment with a plain list of links. React still mounts normally
 * (createRoot replaces #root), so users get the usual SPA.
 */
@Injectable()
export class ArticleSeoMiddleware implements NestMiddleware {
  private readonly logger = new Logger(ArticleSeoMiddleware.name);
  private cachedHtml: string | null | undefined;

  constructor(private readonly articles: ArticlesService) {}

  private html(): string | null {
    if (this.cachedHtml === undefined) {
      const p = join(__dirname, '..', '..', 'webapp', 'dist', 'index.html');
      this.cachedHtml = existsSync(p) ? readFileSync(p, 'utf8') : null;
    }
    return this.cachedHtml ?? null;
  }

  async use(req: Request, res: Response, next: () => void): Promise<void> {
    const base = this.html();
    if (!base) return next();

    // Path without query string, e.g. "/articles/skhemy-yanga-spisok"
    const path = req.path.replace(/\/+$/, '');
    const match = /^\/articles\/([a-z0-9-]+)$/i.exec(path);
    if (!match && path !== '/articles') return next();

    try {
      const page = match
        ? await this.articlePage(match[1])
        : await this.listPage();
      // Alias domains get their own canonical/og:url host. Аудит 2026-10 (I3):
      // host берётся из заголовка Host и только из allow-list алиасов, не из
      // клиентского X-Forwarded-Host (иначе инъекция в canonical/og:url).
      let out = injectSeo(base, page);
      const host = requestHost(req);
      if (PRACTICE_ALIAS_HOSTS.has(host)) {
        out = out.split(SITE_URL).join(`https://${host}`);
      }
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.send(out);
    } catch (err) {
      // Unknown slug (findBySlug throws) or DB error → SPA renders as before.
      if (!(err instanceof ArticleLookupError)) {
        this.logger.warn(
          `SEO injection failed for ${path}: ${(err as Error).message}`,
        );
      }
      next();
    }
  }

  private async articlePage(slug: string): Promise<SeoPage> {
    let article: Awaited<ReturnType<ArticlesService['findBySlug']>>;
    try {
      article = await this.articles.findBySlug(slug);
    } catch {
      throw new ArticleLookupError();
    }
    const url = `${SITE_URL}/articles/${slug}`;
    return {
      title: `${article.title} – Григорий Котляревский`,
      ogTitle: article.title,
      description: article.description,
      canonicalUrl: url,
      ogType: 'article',
      bodyHtml: buildArticleBody(article),
      jsonLd: buildArticleJsonLd(article, url),
    };
  }

  private async listPage(): Promise<SeoPage> {
    const articles = await this.articles.list();
    return {
      title: LIST_TITLE,
      description: LIST_DESCRIPTION,
      canonicalUrl: `${SITE_URL}/articles`,
      ogType: 'website',
      bodyHtml: buildArticlesListBody(articles),
    };
  }
}

/** Неизвестный slug — штатный случай (SPA покажет 404), в лог не пишем. */
class ArticleLookupError extends Error {}
