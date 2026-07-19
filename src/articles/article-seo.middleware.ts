import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import type { Request, Response } from 'express';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { ArticlesService } from './articles.service';

const CANONICAL_HOST = 'https://schemehappens.ru';

/**
 * Server-side SEO injection for article routes.
 *
 * The site is a client-rendered SPA: without this, every /articles/* URL is
 * served the same static index.html with an identical <title>/description, so
 * search engines (especially Yandex, which barely runs JS) see the article
 * pages as empty duplicates of the homepage and never rank them.
 *
 * This middleware runs BEFORE ServeStatic. For an article URL it fetches the
 * article from the DB and injects a real per-page <title>, meta description,
 * canonical, Open Graph tags, an Article JSON-LD block, AND the article text
 * into #root — so a crawler receives fully-formed HTML. React still mounts
 * normally (createRoot replaces #root), so users get the usual SPA.
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
    if (!match) return next(); // /articles list and everything else → SPA as-is

    const slug = match[1];
    let article: Awaited<ReturnType<ArticlesService['findBySlug']>>;
    try {
      article = await this.articles.findBySlug(slug);
    } catch {
      return next(); // unknown slug → let SPA render its 404
    }

    try {
      const url = `${CANONICAL_HOST}/articles/${slug}`;
      const title = `${article.title} | schemehappens.ru`;
      const desc = article.description;
      const dateIso = new Date(article.date).toISOString();

      const jsonLd = JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'Article',
        headline: article.title,
        description: article.description,
        datePublished: dateIso,
        dateModified: dateIso,
        author: {
          '@type': 'Person',
          name: 'Котляревский Григорий Юрьевич',
          url: CANONICAL_HOST,
        },
        publisher: {
          '@type': 'Person',
          name: 'Котляревский Григорий Юрьевич',
        },
        mainEntityOfPage: { '@type': 'WebPage', '@id': url },
        ...(article.heroImage ? { image: article.heroImage } : {}),
        inLanguage: 'ru',
      });

      // Crawler-visible body: real heading + lead + article HTML. Strip any
      // <script> defensively (content is admin-authored, but belt-and-braces).
      const bodyHtml =
        `<article>` +
        `<h1>${esc(article.title)}</h1>` +
        `<p>${esc(article.description)}</p>` +
        stripScripts(article.content) +
        `</article>`;

      let out = base
        .replace(/<title>[\s\S]*?<\/title>/, `<title>${esc(title)}</title>`)
        .replace(
          /<meta name="description" content="[\s\S]*?"\s*\/?>/,
          `<meta name="description" content="${esc(desc)}" />`,
        )
        .replace(
          /<link rel="canonical" href="[\s\S]*?"\s*\/?>/,
          `<link rel="canonical" href="${esc(url)}" />`,
        )
        .replace(
          /<meta property="og:url"\s+content="[\s\S]*?"\s*\/?>/,
          `<meta property="og:url" content="${esc(url)}" />`,
        )
        .replace(
          /<meta property="og:title"\s+content="[\s\S]*?"\s*\/?>/,
          `<meta property="og:title" content="${esc(article.title)}" />`,
        )
        .replace(
          /<meta property="og:description"\s+content="[\s\S]*?"\s*\/?>/,
          `<meta property="og:description" content="${esc(desc)}" />`,
        )
        .replace(
          /<meta property="og:type"\s+content="[\s\S]*?"\s*\/?>/,
          `<meta property="og:type" content="article" />`,
        )
        .replace(
          '<div id="root"></div>',
          `<div id="root">${bodyHtml}</div>` +
            `<script type="application/ld+json">${jsonLd}</script>`,
        );

      // Alias domains get their own canonical/og:url host.
      if (req.hostname && req.hostname !== 'schemehappens.ru') {
        out = out.split(CANONICAL_HOST).join(`https://${req.hostname}`);
      }

      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.send(out);
    } catch (err) {
      this.logger.warn(
        `SEO injection failed for ${slug}: ${(err as Error).message}`,
      );
      next();
    }
  }
}

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function stripScripts(html: string): string {
  return html.replace(/<script[\s\S]*?<\/script>/gi, '');
}
