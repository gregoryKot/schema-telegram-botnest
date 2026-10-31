// «Мост к терапевту» (правило №8): приложение говорит «это самопомощь, не
// замена терапии» и ведёт на запись к автору. Реестр рядом с фичей; в
// ANALYTICS_EVENTS событие попадает через HOME_EVENTS (home-events.constants.ts).
// Парная константа на фронте — в shared/ (синхронно).
//
//   therapy_nudge — показали или нажали строку/карточку моста.
//               meta { place: THERAPY_NUDGE_PLACES, action: THERAPY_NUDGE_ACTIONS,
//               trigger?: THERAPY_NUDGE_TRIGGERS } — только эти поля и только
//               значения из списков. Блок в /stats — «Мост к терапевту»
//               (therapy-nudge-metrics.format.ts).
export const THERAPY_NUDGE_EVENT = 'therapy_nudge';

export const THERAPY_NUDGE_PLACES = [
  'home',
  'tracker_done',
  'case_done',
  'diary_done',
  'more',
  'signal_card',
] as const;
export type TherapyNudgePlace = (typeof THERAPY_NUDGE_PLACES)[number];

export const THERAPY_NUDGE_ACTIONS = [
  'shown',
  'open',
  'book',
  'write',
  'dismiss',
] as const;
export type TherapyNudgeAction = (typeof THERAPY_NUDGE_ACTIONS)[number];

export const THERAPY_NUDGE_TRIGGERS = [
  'low_index',
  'repeat_mode',
  'crisis',
  'none',
] as const;
export type TherapyNudgeTrigger = (typeof THERAPY_NUDGE_TRIGGERS)[number];
