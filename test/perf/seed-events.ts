// События аналитики (AnalyticsEvent) в синтетике «горизонт роста» — шаг
// сидера (test/perf/seed-steps.ts): по одной вставке на событие из плана
// `eventPlan()` (seed-profile.ts — веса, доля анонимных, наборы meta). Читает
// их почти весь отчёт /stats (сценарий stats-report).
//
// meta — смешанная система счисления: значения ключей независимы друг от
// друга; анонимные строки (userId NULL) помечены PERF_SEED_MARK — каскад по
// User их не снесёт, чистка сидера находит их по пометке.
import { eventPlan, PERF_PROFILE as P, PERF_SEED_MARK } from './seed-profile';
import { json, pick, q, series, tsBack } from './seed-sql';

type EventRows = ReturnType<typeof eventPlan>[number];

function eventSql(a: string, s: EventRows): string {
  let radix = 1;
  const parts = Object.entries(s.meta ?? {}).map(([k, vals]) => {
    const expr = `${q(k)}, (${json(vals)} -> (((g.i / ${radix}) % ${vals.length})::int))`;
    radix *= vals.length;
    return expr;
  });
  const meta = parts.length
    ? `jsonb_build_object(${parts.join(', ')})`
    : 'NULL::jsonb';
  return `INSERT INTO "AnalyticsEvent"("userId","name","meta","createdAt")
SELECT t.uid, ${q(s.name)},
  CASE WHEN t.uid IS NULL THEN COALESCE(t.meta, '{}'::jsonb) || ${json(PERF_SEED_MARK)} ELSE t.meta END, t.at
FROM (SELECT CASE WHEN ((g.i * 7937) % 10037) % 100 < ${s.anon ?? 0} THEN NULL ELSE ${pick('g.i')} END AS uid,
  ${meta} AS meta, ${tsBack(a, 'g.i', P.eventSpreadDays)} AS at FROM ${series(s.rows)}) t`;
}

/** `a` — SQL-выражение момента запуска сидера (timestamp UTC). */
export function analyticsEventSql(a: string): string[] {
  return eventPlan().map((s) => eventSql(a, s));
}
