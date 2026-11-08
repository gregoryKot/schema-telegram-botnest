// Поля POST /api/settings, которые контроллер обрабатывает одинаково.
// Вынесено из settings.controller.ts (правило №10): до этого каждое поле
// было своей парой строк `if (typeof body.x === 'boolean') clean.x = …`.

// Флаги, которые POST переносит как есть, если пришёл boolean.
export const BOOLEAN_SETTINGS = [
  'notifyEnabled',
  'notifyReminderEnabled',
  'notifySummaryEnabled',
  'notifyGamified',
  'pairCardDismissed',
  'therapistShareCards',
  'therapistShareProfile',
] as const;
// Поля, после записи которых пересобирается напоминание.
export const RESCHEDULE_ON = [
  'notifyEnabled',
  'notifyLocalHour',
  'notifyTimezone',
  'notifyReminderEnabled',
  'notifySummaryEnabled',
  'notifyFrequency',
  'notifyPausedUntil',
] as const;
