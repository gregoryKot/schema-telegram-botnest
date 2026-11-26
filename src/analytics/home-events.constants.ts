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
//   done_next_step — тап по предложенному «Что дальше» после трекера или быстрой
//               записи дневника, meta { from: NEXT_STEP_FROM, to: NEXT_STEP_TO }.
//               Строка в /stats — «Что дальше: …».
//   therapy_nudge — «Мост к терапевту»; реестр, meta и блок в /stats —
//               therapy-nudge.constants.ts.
import { THERAPY_NUDGE_EVENT } from './therapy-nudge.constants';

export const HOME_EVENTS = [
  'home_tile',
  'tracker_skip',
  'diary_quick_save',
  'done_next_step',
  THERAPY_NUDGE_EVENT,
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
  'calm', // с 2026-11-05 не шлётся: «Подышим» ушёл с главной; оставлен ради старых записей
  'why',
  'feed_all', // с 2026-11-05 не шлётся: ленты дня на главной нет; оставлен ради старых записей
  'selfmap', // знак «Карты себя» в шапке
] as const;
export type HomeTile = (typeof HOME_TILES)[number];

export const NEXT_STEP_FROM = ['tracker', 'diary'] as const;
export const NEXT_STEP_TO = ['case', 'practice', 'mode', 'schema'] as const;
export type NextStepFrom = (typeof NEXT_STEP_FROM)[number];
export type NextStepTo = (typeof NEXT_STEP_TO)[number];
