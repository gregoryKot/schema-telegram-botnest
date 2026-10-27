// Главная «Сегодня» сайта: нажатие на плитку или ссылку (правило №8).
// Реестр рядом с фичей, вынесен из analytics.constants.ts (правило №10).
// Парная константа на фронте — shared/src/analytics/homeTile.ts (синхронно).
//
//   home_tile — нажал плитку или ссылку на главной (meta.tile: HOME_TILES).
//               Блок в /stats — «Главная: плитки» (screen-metrics.format.ts).
export const HOME_EVENTS = ['home_tile'] as const;

export const HOME_TILES = [
  'tracker',
  'case',
  'diary',
  'calm',
  'why',
  'feed_all',
] as const;
export type HomeTile = (typeof HOME_TILES)[number];
