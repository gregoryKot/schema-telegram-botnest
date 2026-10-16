// Строка сырого запроса ClientErrorMetricsService.getMetrics: ровно те колонки,
// что отдаёт SELECT (все — count()/sum() с ::bigint, поэтому не null). Отдельный
// файл — чтобы сервис не рос из-за списка колонок (правило №10) и при этом тип
// остался строгим: опечатка в ключе (`row?.repeats_wek`) ломает tsc, а не молча
// даёт 0. Порядок и состав колонок сверяет спек сервиса и живой спек /stats
// (test/raw-sql-live-stats.e2e-spec.ts).
export interface ClientErrorMetricsRow {
  total_day: bigint;
  total_week: bigint;
  auth_day: bigint;
  auth_week: bigint;
  login_week: bigint;
  today_week: bigint;
  diary_week: bigint;
  schemas_week: bigint;
  practice_week: bigint;
  profile_week: bigint;
  help_week: bigint;
  cabinet_week: bigint;
  booking_week: bigint;
  other_week: bigint;
  webapp_week: bigint;
  miniapp_week: bigint;
  repeats_week: bigint;
  unlogged_week: bigint;
}
