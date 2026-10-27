// Главная «Сегодня» сайта: нажатие на плитку или ссылку (правило №8).
// Реестр рядом с фичей, вынесен из analytics.constants.ts (правило №10).
// Парная константа на фронте — shared/src/analytics/homeTile.ts (синхронно).
//
//   home_tile — нажал плитку или ссылку на главной (meta.tile: HOME_TILES).
//               Блок в /stats — «Главная: плитки» (screen-metrics.format.ts).
//   tracker_skip — «Пропустить» на вопросе трекера (простой клиент, этап 2),
//               без meta. Строка в /stats — «Трекер: пропусков N».
//   diary_quick_save — сохранил запись «Дневника одной страницей» (простой
//               клиент, этап 3), meta { tag: DIARY_QUICK_TAGS, detailed:
//               boolean } — detailed=true, если запись ушла через «Заполнить
//               подробно» (старый мастер). Строка в /stats — «Дневник одной
//               страницей: …».
export const HOME_EVENTS = [
  'home_tile',
  'tracker_skip',
  'diary_quick_save',
] as const;

export const DIARY_QUICK_TAGS = [
  'thought',
  'schema',
  'mode',
  'gratitude',
] as const;
export type DiaryQuickTag = (typeof DIARY_QUICK_TAGS)[number];

export const HOME_TILES = [
  'tracker',
  'case',
  'diary',
  'calm',
  'why',
  'feed_all',
] as const;
export type HomeTile = (typeof HOME_TILES)[number];
