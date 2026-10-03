// События, которые пишутся БЕЗ userId (аудит 2026-10, D4).
//
// crisis_card_shown / crisis_hotline_tapped — строка «человек X увидел
// кризисную карточку» в открытом виде (meta не шифруется) и есть маркер
// суицидальных мыслей, привязанный к личности, с хранением 90 дней
// (RETENTION_DAYS в analytics.service.ts). Отчёту /stats нужны только счётчики
// (`ev(name)` в bot.product-metrics.service.ts — count(*) по имени, без
// группировки по userId), поэтому связь с человеком не нужна и не пишется.
// Лежит отдельным файлом, а не рядом с ANALYTICS_EVENTS: тот файл заморожен в
// храповике размера (правило №10).
import type { AnalyticsEventName } from './analytics.constants';

export const ANONYMOUS_EVENTS: readonly AnalyticsEventName[] = [
  'crisis_card_shown',
  'crisis_hotline_tapped',
];

/** userId, который реально пишется в строку события. */
export function eventOwnerId(
  name: AnalyticsEventName,
  userId: bigint | null,
): bigint | null {
  return ANONYMOUS_EVENTS.includes(name) ? null : userId;
}
