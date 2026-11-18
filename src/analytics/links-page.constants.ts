// Страница ссылок kotlarewski.gr/links: событие links_page_click
// { target, from } — какую кнопку нажали и из какой соцсети пришли. Гость без
// входа, поэтому событие анонимное (POST /api/public-event). Парные списки на
// сайте — shared/src/analytics/linksPage.ts (сверка — links-page.sync.spec.ts).
export const LINKS_PAGE_EVENTS = ['links_page_click'] as const;

export const LINKS_PAGE_TARGETS = [
  'booking',
  'project',
  'channel_ha',
  'channel_schema',
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

const TARGETS: ReadonlySet<string> = new Set(LINKS_PAGE_TARGETS);
const FROM: ReadonlySet<string> = new Set(LINKS_PAGE_FROM);

/** Только target и from из списков; иначе null — событие не пишется. */
export function sanitizeLinksPageMeta(
  meta: Record<string, unknown> | undefined,
): { target: string; from: string } | null {
  const target = meta?.target;
  const from = meta?.from;
  return typeof target === 'string' &&
    TARGETS.has(target) &&
    typeof from === 'string' &&
    FROM.has(from)
    ? { target, from }
    : null;
}
