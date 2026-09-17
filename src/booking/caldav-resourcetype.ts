// Классификация одного <response>-блока PROPFIND Depth 1 по
// calendar-home-set. Вынесено из caldav-discovery.ts отдельно, чтобы фильтр
// был чистой тестируемой функцией (без сети) и чтобы caldav-discovery.ts не
// упёрся в лимит размера файла (правило №10 CLAUDE.md).

/** Содержимое между <prop>...</prop> в xml, любой namespace-префикс. */
const block = (xml: string, prop: string): string =>
  xml.match(
    new RegExp(`<[^>]*${prop}[^>]*>([\\s\\S]*?)</[^>]*${prop}\\s*>`, 'i'),
  )?.[1] ?? '';

/**
 * True когда XML-фрагмент <resourcetype>…</resourcetype> содержит элемент
 * calendar — в любом namespace-префиксе, с атрибутами или без. Раньше
 * матчился только `<c:calendar/>` БЕЗ атрибутов — реальный iCloud отдаёт
 * `<C:calendar xmlns:C="urn:ietf:params:xml:ns:caldav"/>`, и фильтр пропускал
 * ВСЕ календари: список пустой, занятость всегда «0» без единой ошибки
 * (инцидент 2026-09-16, регресс PR #491). Смотрим на ЛОКАЛЬНОЕ ИМЯ тега
 * целиком, не на префикс — иначе `calendar-proxy-read`/`-write` тоже
 * совпали бы.
 */
export function isCalendarResource(resourcetypeXml: string): boolean {
  return /<([a-z0-9_-]+:)?calendar(\s[^>]*)?\/?\s*>/i.test(resourcetypeXml);
}

export type SkipReason = 'root-or-system' | 'not-calendar' | 'no-vevent';

export interface ClassifiedResponse {
  href: string;
  calendar: { url: string; name: string } | null;
  skip: SkipReason | null;
}

const abs = (origin: string, pathOrUrl: string): string =>
  /^https?:\/\//i.test(pathOrUrl) ? pathOrUrl : origin + pathOrUrl;

/** Разбирает один <response>-блок: календарь для занятости или причина пропуска. */
export function classifyResponse(
  r: string,
  homeUrl: string,
  homeOrigin: string,
): ClassifiedResponse {
  const href = (r.match(/<[^>]*href[^>]*>\s*([^<]+?)\s*</i)?.[1] ?? '').trim();
  if (!href) return { href, calendar: null, skip: 'root-or-system' };
  const url = abs(homeOrigin, href).replace(/\/?$/, '/');
  // Инцидент 2026-09-13: корень тоже отвечает VEVENT в component-set —
  // старый фильтр пропускал его в список → REPORT в корень → 403 iCloud.
  if (url === homeUrl || /inbox|outbox|notification/i.test(href))
    return { href, calendar: null, skip: 'root-or-system' };
  if (!isCalendarResource(block(r, 'resourcetype')))
    return { href, calendar: null, skip: 'not-calendar' };
  if (!/VEVENT/i.test(block(r, 'supported-calendar-component-set')))
    return { href, calendar: null, skip: 'no-vevent' };
  const name = (
    r.match(/<[^>]*displayname[^>]*>\s*([^<]*?)\s*</i)?.[1] ?? ''
  ).trim();
  return { href, calendar: { url, name }, skip: null };
}
