// Нажатия на главной «Сегодня» сайта (правило №8): плитки, «Зачем это?»,
// «Все записи», «Подышим». Событие home_tile, meta { tile }. Парный allow-list —
// HOME_TILES в src/analytics/home-events.constants.ts (при добавлении синхронь оба).
export const HOME_TILE_EVENT = 'home_tile';

export type HomeTile =
  'tracker' | 'case' | 'diary' | 'calm' | 'why' | 'feed_all';

// «Пропустить» на вопросе трекера (простой клиент, этап 2). Без meta.
// Парный реестр — HOME_EVENTS в src/analytics/home-events.constants.ts.
export const TRACKER_SKIP_EVENT = 'tracker_skip';

// Сохранение в «Дневнике одной страницей» (простой клиент, этап 3):
// meta { tag, detailed }. Парный реестр — HOME_EVENTS и DIARY_QUICK_TAGS в
// src/analytics/home-events.constants.ts (при добавлении синхронь оба).
export const DIARY_QUICK_SAVE_EVENT = 'diary_quick_save';

export type DiaryQuickTag = 'thought' | 'schema' | 'mode' | 'gratitude';

export interface DiaryQuickSaveMeta {
  tag: DiaryQuickTag;
  /** true — запись ушла через «Заполнить подробно» (старый мастер). */
  detailed: boolean;
}
