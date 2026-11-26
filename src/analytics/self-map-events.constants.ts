/**
 * Событие «Карты себя»: переход-мост между картой и соседними экранами.
 * Отдельный файл — analytics.constants.ts упёрся в храповик размера (№10).
 *
 * Шлёт сайт литералом: api.trackEvent('self_map_link', { to }) — так его видит
 * analytics-sync. Санитайзер — src/api/analytics-meta.sanitize-self-map.ts,
 * блок /stats — src/bot/self-map-metrics.format.ts. weekly_repeat_queued — серверное, meta.kind mode|need.
 */
export const SELF_MAP_EVENTS = ['self_map_link', 'weekly_repeat_queued'] as const;

/** Куда ведёт переход: meta.to. */
export const SELF_MAP_LINK_TARGETS = [
  'mode', // тап по режиму на карте — карточка режима
  'schema', // тап по схеме в полосе «Откуда тянется»
  'patterns', // с карты в «Мои паттерны»
  'ysq_test', // из полосы «Откуда тянется» в тест на схемы
  'map', // из «Моих паттернов» (вкладка «Режимы») на карту себя
] as const;

export type SelfMapLinkTarget = (typeof SELF_MAP_LINK_TARGETS)[number];

export const SELF_MAP_LINK_TARGET_SET: ReadonlySet<string> = new Set(
  SELF_MAP_LINK_TARGETS,
);
