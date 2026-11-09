import { CANONICAL_HOST } from '../infra/canonical-host';
import { sanitizeArticleHtml } from './article-html-sanitize';

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
 * Текст для краулера: заголовок, лид и тело статьи. Тело — через тот же
 * allowlist, что DOMPurify на клиенте (article-html-sanitize.ts, аудит 2026-11
 * S19): контент пишет админ, но ответ отдаётся с нашего домена всем.
 */
export function buildArticleBody(article: SeoArticle): string {
  return (
    `<article>` +
    `<h1>${esc(article.title)}</h1>` +
    `<p>${esc(article.description)}</p>` +
    sanitizeArticleHtml(article.content) +
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
  const cardTitle = esc(page.ogTitle ?? page.title);
  // twitter:* читают X и площадки помимо og:* (Telegram и VK берут og:*):
  // без этих строк превью статьи там показывало заголовок сайта или визитки.
  const metas: [attr: string, key: string, value: string][] = [
    ['name', 'description', desc],
    ['property', 'og:url', url],
    ['property', 'og:title', cardTitle],
    ['property', 'og:description', desc],
    ['property', 'og:type', esc(page.ogType)],
    ['name', 'twitter:title', cardTitle],
    ['name', 'twitter:description', desc],
  ];
  // `<` в JSON экранируется, чтобы текст вроде "</script>" не закрыл тег.
  const jsonLdTag = page.jsonLd
    ? `<script type="application/ld+json">${JSON.stringify(page.jsonLd).replace(/</g, '\\u003c')}</script>`
    : '';
  return metas
    .reduce(
      (out, [attr, key, value]) =>
        out.replace(
          new RegExp(`<meta ${attr}="${key}"\\s+content="[^"]*"\\s*/?>`),
          () => `<meta ${attr}="${key}" content="${value}" />`,
        ),
      baseHtml,
    )
    .replace(
      /<title>[\s\S]*?<\/title>/,
      () => `<title>${esc(page.title)}</title>`,
    )
    .replace(
      /<link rel="canonical" href="[^"]*"\s*\/?>/,
      () => `<link rel="canonical" href="${url}" />`,
    )
    .replace(
      '<div id="root"></div>',
      () => `<div id="root">${page.bodyHtml}</div>${jsonLdTag}`,
    );
}
