// «Мост к терапевту» (простой клиент, 2026-10-27): напоминание «это самопомощь,
// не замена терапии» и выход на запись. Событие therapy_nudge, meta
// { place, action, trigger? } — без текстов и оценок пользователя.
// Парный реестр — src/analytics/therapy-nudge.constants.ts (при добавлении
// значений синхронь оба).
export const THERAPY_NUDGE_EVENT = 'therapy_nudge';

/** Где показана строка/карточка/лист. */
export type TherapyNudgePlace =
  'home' | 'tracker_done' | 'case_done' | 'diary_done' | 'more' | 'signal_card';

/** shown — показали; open — открыли лист; book — «Записаться»; write — написали (Telegram/терапевту); dismiss — «Не сейчас». */
export type TherapyNudgeAction =
  'shown' | 'open' | 'book' | 'write' | 'dismiss';

/** Что вызвало карточку по сигналу; у остальных мест — none или без поля. */
export type TherapyNudgeTrigger =
  'low_index' | 'repeat_mode' | 'crisis' | 'none';

export interface TherapyNudgeMeta {
  place: TherapyNudgePlace;
  action: TherapyNudgeAction;
  trigger?: TherapyNudgeTrigger;
}
