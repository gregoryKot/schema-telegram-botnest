// Страница ссылок kotlarewski.gr/links: белый список целей клика (meta.target
// события links_page_click). Серверная копия — src/analytics/links-page.constants.ts,
// сверка — links-page.sync.spec.ts. Файл без импортов: спек бэкенда исполняет его как есть.

/** Ссылки страницы в порядке показа: пункт и следом его площадки. */
export const LINKS_PAGE_TARGETS = [
  'booking',
  'project',
  'project_tg',
  'project_max',
  'channel_ha',
  'ha_threads',
  'ha_vk',
  'ha_max',
  'channel_schema',
  'schema_max',
  'about',
  'articles',
  'write',
] as const;
export type LinksPageTarget = (typeof LINKS_PAGE_TARGETS)[number];
