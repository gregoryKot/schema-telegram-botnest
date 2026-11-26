// Страница ссылок: meta события links_page_click пропускает только значения
// из белых списков (правило №8) — свободного текста в meta нет.
import { LINKS_PAGE_FROM, LINKS_PAGE_TARGETS } from './links-page.constants';

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
