// Тип карточки для событий share_card / share_result (meta.kind).
// Отдельным файлом: список растёт с каждой новой карточкой, а
// analytics.constants.ts уже сверх лимита размера (правило №10) — приём
// тот же, что у crisis-surfaces.constants.ts и signup-sources.constants.ts.
export const SHARE_CARD_KINDS = [
  'weekly',
  'day',
  'achievement',
  'streak',
  'schema',
  'diary',
  'ysq',
  'mode',
  'mode_entry',
  'pair_invite',
  'app_invite',
  'therapist_invite',
  'month',
  'achievements',
  'phrase',
  'gratitude',
  'journey',
  'journey_item',
  'practice',
  'mode_entry_full',
  'phrase_check',
  'phrase_check_full',
] as const;
export type ShareCardKind = (typeof SHARE_CARD_KINDS)[number];
