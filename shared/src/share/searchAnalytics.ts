// Аналитика общего поиска (палитра ⌘K, правило №8): открыли найденное — клиента, раздел, лист
// справочника или действие. Парный allow-list — src/analytics/cabinet-events.constants.ts, строка
// в /stats — src/bot/search-metrics.*. Текст запроса, имя клиента и название листа в событие не
// попадают (правило №7). Имя в trackEvent — строковым литералом: так его видит трипваер analytics-sync.
export const SEARCH_RESULT_OPEN_EVENT = 'search_result_open';

export const SEARCH_RESULT_KINDS = [
  'client',
  'section',
  'guide',
  'action',
] as const;
export type SearchResultKind = (typeof SEARCH_RESULT_KINDS)[number];

interface Tracker {
  trackEvent(name: string, meta?: Record<string, unknown>): void;
}

/** Открыта строка поиска; `typed` — был ли введён запрос (сам запрос не отправляется), `recent` — строка из «Недавнего». */
export function trackSearchResultOpen(
  api: Tracker,
  kind: SearchResultKind,
  typed: boolean,
  recent: boolean,
): void {
  api.trackEvent('search_result_open', { kind, typed, recent });
}
