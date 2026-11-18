// Страница ссылок kotlarewski.gr/links: белые списки события links_page_click
// (имя — LINKS_PAGE_CLICK_EVENT в share/analytics.ts). Серверная копия —
// src/analytics/links-page.constants.ts, сверка — links-page.sync.spec.ts.
// Файл без импортов: спек бэкенда исполняет его как есть.

/** Кнопки страницы (meta.target) в порядке показа. */
export const LINKS_PAGE_TARGETS = [
  'booking',
  'project',
  'channel_ha',
  'channel_schema',
  'about',
  'articles',
  'write',
] as const;
export type LinksPageTarget = (typeof LINKS_PAGE_TARGETS)[number];

/** Соцсети, из шапок которых ведёт ссылка (метка utm_source). */
export const LINKS_PAGE_SOURCES = [
  'telegram',
  'instagram',
  'max',
  'vk',
  'youtube',
] as const;
export type LinksPageFrom =
  (typeof LINKS_PAGE_SOURCES)[number] | 'other' | 'direct';

/** Откуда пришли (meta.from): метка из списка, чужая метка — other, без метки — direct. */
export function linksPageFrom(search: string): LinksPageFrom {
  const raw = new URLSearchParams(search).get('utm_source');
  if (!raw) return 'direct';
  const source = raw.trim().toLowerCase();
  const known = LINKS_PAGE_SOURCES.find((s) => s === source);
  return known ?? 'other';
}
