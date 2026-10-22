import { CANONICAL_HOST } from '../infra/canonical-host';

export const SITE_URL = `https://${CANONICAL_HOST}`;
const AUTHOR_NAME = 'Котляревский Григорий Юрьевич';

type DateLike = Date | string;

/** Поля, по которым считается дата последнего изменения. */
export interface Dated {
  date: DateLike;
  updatedAt?: Date | null;
}

export interface SeoArticle extends Dated {
  slug: string;
  title: string;
  description: string;
  content: string;
  heroImage?: string | null;
}

/** Элемент списка, как его отдаёт `ArticlesService.list()`. */
export interface SeoArticleListItem extends Dated {
  slug: string;
  title: string;
  description: string;
}

export function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function stripScripts(html: string): string {
  return html.replace(/<script[\s\S]*?<\/script>/gi, '');
}

/**
 * Более поздняя из дат: публикации и последней правки. Поисковикам и
 * нейросетям нужна честная дата обновления; без `updatedAt` (старые
 * фикстуры, неполная выборка) — дата публикации.
 */
export function lastModified(article: Dated): Date {
  const published = new Date(article.date);
  const updated = article.updatedAt ? new Date(article.updatedAt) : null;
  return updated && updated.getTime() > published.getTime()
    ? updated
    : published;
}

export function buildArticleJsonLd(article: SeoArticle, url: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: article.title,
    description: article.description,
    datePublished: new Date(article.date).toISOString(),
    dateModified: lastModified(article).toISOString(),
    author: { '@type': 'Person', name: AUTHOR_NAME, url: SITE_URL },
    publisher: { '@type': 'Person', name: AUTHOR_NAME },
    mainEntityOfPage: { '@type': 'WebPage', '@id': url },
    ...(article.heroImage ? { image: article.heroImage } : {}),
    inLanguage: 'ru',
  };
}

/**
 * Текст для краулера: заголовок, лид и тело статьи. <script> вырезается
 * заранее (контент пишет админ, но лишний замок не мешает).
 */
export function buildArticleBody(article: SeoArticle): string {
  return (
    `<article>` +
    `<h1>${esc(article.title)}</h1>` +
    `<p>${esc(article.description)}</p>` +
    stripScripts(article.content) +
    `</article>`
  );
}

export function buildArticlesListBody(articles: SeoArticleListItem[]): string {
  const items = articles
    .map(
      (a) =>
        `<li><a href="/articles/${esc(a.slug)}">${esc(a.title)}</a> – ` +
        `${esc(a.description)}</li>`,
    )
    .join('');
  return `<section><h1>Статьи о схема-терапии</h1><ul>${items}</ul></section>`;
}

export interface SeoPage {
  title: string;
  /** og:title; по умолчанию равен title. */
  ogTitle?: string;
  description: string;
  canonicalUrl: string;
  ogType: string;
  bodyHtml: string;
  jsonLd?: object;
}

/** Подставляет SEO-теги и текст страницы в собранный index.html. */
export function injectSeo(baseHtml: string, page: SeoPage): string {
  const url = esc(page.canonicalUrl);
  const desc = esc(page.description);
  // `<` в JSON экранируется, чтобы текст вроде "</script>" не закрыл тег.
  const jsonLdTag = page.jsonLd
    ? `<script type="application/ld+json">${JSON.stringify(page.jsonLd).replace(/</g, '\\u003c')}</script>`
    : '';
  return baseHtml
    .replace(
      /<title>[\s\S]*?<\/title>/,
      () => `<title>${esc(page.title)}</title>`,
    )
    .replace(
      /<meta name="description" content="[\s\S]*?"\s*\/?>/,
      () => `<meta name="description" content="${desc}" />`,
    )
    .replace(
      /<link rel="canonical" href="[\s\S]*?"\s*\/?>/,
      () => `<link rel="canonical" href="${url}" />`,
    )
    .replace(
      /<meta property="og:url"\s+content="[\s\S]*?"\s*\/?>/,
      () => `<meta property="og:url" content="${url}" />`,
    )
    .replace(
      /<meta property="og:title"\s+content="[\s\S]*?"\s*\/?>/,
      () =>
        `<meta property="og:title" content="${esc(page.ogTitle ?? page.title)}" />`,
    )
    .replace(
      /<meta property="og:description"\s+content="[\s\S]*?"\s*\/?>/,
      () => `<meta property="og:description" content="${desc}" />`,
    )
    .replace(
      /<meta property="og:type"\s+content="[\s\S]*?"\s*\/?>/,
      () => `<meta property="og:type" content="${esc(page.ogType)}" />`,
    )
    .replace(
      '<div id="root"></div>',
      () => `<div id="root">${page.bodyHtml}</div>${jsonLdTag}`,
    );
}
