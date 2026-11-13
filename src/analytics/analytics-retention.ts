// Ретеншен AnalyticsEvent (L10, аудит 2026-08): таблица росла без ограничения.
// Метрики /stats считаются в окнах ≤30 дней, поэтому держим 90 (щедрый буфер) и
// раз в сутки удаляем старше — диск не течёт, окна метрик не задеты.
//
// Отдельный файл, а не константа в analytics.service.ts: подписи отчёта /stats
// («за последние 90 дней», therapist-exit-metrics.format.ts; «за всё время»,
// data-export-metrics.format.ts) обязаны совпадать с тем, что на деле удаляет
// pruneOld, — один источник, а не второй литерал (правило №4).
export const EVENT_RETENTION_DAYS = 90;

// data_export живёт до удаления аккаунта (каскад на User): след ответа на право
// доступа по 152-ФЗ нужен весь (решение владельца, аудит 2026-10).
export const KEPT_UNTIL_ACCOUNT_DELETION = ['data_export'];

/** Что удаляет ночная чистка pruneOld: старше срока и не из хранимых. */
export const prunableWhere = (now: number) => ({
  createdAt: { lt: new Date(now - EVENT_RETENTION_DAYS * 86_400_000) },
  name: { notIn: KEPT_UNTIL_ACCOUNT_DELETION },
});
