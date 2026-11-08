// Типы уведомлений и их классы — вынесено из notification.service.ts (правило
// №10): сервис упёрся в потолок, а списки читают и очередь, и планировщик, и
// реакция на заполнение трекера.

export type NotificationType =
  | 'reminder'
  | 'pre_reminder'
  | 'summary'
  | 'comeback'
  | 'welcome_back'
  | 'onboarding_1'
  | 'onboarding_3'
  | 'onboarding_7'
  | 'streak_7'
  | 'streak_14'
  | 'streak_30'
  | 'lapsing_3'
  | 'dormant_7'
  | 'value_recap'
  | 'reengagement_30'
  | 'weekly'
  | 'donate_reminder'
  | 'anniversary_30'
  | 'anniversary_60'
  | 'anniversary_90'
  | 'practice_reminder'
  | 'practice_missed'
  | 'low_streak_insight'
  | 'nudge'
  | 'task_assigned'
  | 'ysq_requested'
  | 'pair_activity'
  | 'security_notice';

/**
 * Проактивные типы — бот пишет сам, без действия юзера. Подчиняются дневному
 * бюджету (одно в день) и отменяются при паузе. Реактивные (summary, comeback,
 * streak_*, onboarding_*, task_assigned...) — ответ на действие, не отменяются.
 */
export const PROACTIVE_TYPES: NotificationType[] = [
  'reminder',
  'pre_reminder',
  'lapsing_3',
  'dormant_7',
  'value_recap',
  'reengagement_30',
  'nudge',
  'weekly',
  'donate_reminder',
  'practice_missed',
  'low_streak_insight',
  // Парный триггер (аудит 2026-07, 4.5): бот пишет сам по действию напарника —
  // проактивное (дневной бюджет, отмена при паузе), НЕ quiet-exempt (получатель
  // сам ничего не делал — тихие часы уважаются).
  'pair_activity',
];

/**
 * Не задерживаются тихими часами: приходят через секунды после того, как юзер
 * сам был активен (заполнил дневник) — придержать их до утра было бы странно.
 */
export const QUIET_EXEMPT_TYPES: NotificationType[] = [
  'summary',
  'comeback',
  'streak_7',
  'streak_14',
  'streak_30',
  'onboarding_1',
  'onboarding_3',
  'onboarding_7',
  'anniversary_30',
  'anniversary_60',
  'anniversary_90',
  'security_notice', // S11/S12: о входе в аккаунт молчать до утра нельзя
];

/**
 * Напоминания о перерыве: «тебя не было N дней». Заполнение трекера снимает их
 * все, на сегодня и вперёд (R4, аудит 2026-11): вернулся, заполнил — вечером
 * «Неделя без дневника» звучит как упрёк за то, чего уже нет.
 */
export const BREAK_TYPES: NotificationType[] = [
  'lapsing_3',
  'dormant_7',
  'value_recap',
  'reengagement_30',
  'nudge',
];
