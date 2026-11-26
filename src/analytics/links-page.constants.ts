// Страница ссылок kotlarewski.gr/privet: событие links_page_click
// { target, from } — какую кнопку нажали и из какой соцсети пришли. Гость без
// входа, поэтому событие анонимное (POST /api/public-event). Парные списки на
// сайте — shared/src/analytics/linksPage*.ts (сверка — links-page.sync.spec.ts).
export const LINKS_PAGE_EVENTS = ['links_page_click'] as const;

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

export const LINKS_PAGE_SOURCES = [
  'telegram',
  'instagram',
  'max',
  'vk',
  'youtube',
] as const;

/** Значения meta.from: соцсеть из списка, чужая метка, без метки. */
export const LINKS_PAGE_FROM = [
  ...LINKS_PAGE_SOURCES,
  'other',
  'direct',
] as const;
