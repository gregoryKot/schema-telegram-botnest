// Сессии сайта (WebSession) в синтетике «горизонт роста» — шаг сидера
// (test/perf/seed.ts). Читает их гвард на каждом запросе с Bearer:
// `assertLiveAccess` (src/auth/live-access.ts) ищет живую строку семьи по
// `family` (сценарий bearer-guard в scenarios.ts, хвост S12 аудита 2026-11).
//
// Форма повторяет прод, а не только объём:
//  · у трёх из четырёх людей есть вход на сайте, у них 1–3 семьи (устройства);
//  · семья — цепочка ротаций: каждая ротация гасит строку (revokedAt +
//    replacedByHash на наследника) и заводит следующую, живая — последняя;
//  · отозванное ретеншен держит 30 дней (session-retention.service.ts), поэтому
//    цепочка — до 60 строк (пара ротаций в день за месяц);
//  · каждая пятая семья закрыта «Выйти»: живой строки в ней нет вовсе;
//  · строки лежат в куче по времени (ORDER BY createdAt), как в проде, где они
//    рождаются по мере ротаций, — строки одной семьи разбросаны по таблице.
// Итого ~450 000 строк при 10 000 людей. Детерминировано: только арифметика.
import { PERF_ID_BASE as B, PERF_PROFILE as P } from './seed-profile';

/** Длина цепочки семьи: 1..60 строк. */
const CHAIN = 60;

/** `a` — SQL-выражение момента запуска сидера (timestamp UTC). */
export function webSessionSql(a: string): string {
  const tok = (k: string) =>
    `md5(s.u || '-' || s.f || '-' || (${k})) || md5((${k}) || '-' || s.u || '-' || s.f)`;
  return `INSERT INTO "WebSession"("id","userId","tokenHash","family","createdAt","lastUsedAt","expiresAt","revokedAt","replacedByHash")
SELECT 'perf-ws-' || s.u || '-' || s.f || '-' || s.k, ${B} + s.u, ${tok('s.k')},
  md5('perf-family-' || s.u || '-' || s.f), s.at, s.at, s.at + interval '30 days',
  CASE WHEN s.k < s.n THEN s.at + interval '12 hours'
       WHEN (s.u + s.f) % 5 = 0 THEN s.at + interval '1 hour' END,
  CASE WHEN s.k < s.n THEN ${tok('s.k + 1')} END
FROM (
  SELECT u.u, f.f, k.k, c.n,
    ${a} - make_interval(hours => ((c.n - k.k) * 12 + (u.u * 7 + f.f) % 12)::int) AS at
  FROM generate_series(1::bigint, ${P.users}::bigint) u(u)
  CROSS JOIN LATERAL generate_series(1, 1 + (u.u % 3)::int) f(f)
  CROSS JOIN LATERAL (SELECT 1 + ((u.u * 7919 + f.f * 104729) % ${CHAIN})::int AS n) c
  CROSS JOIN LATERAL generate_series(1, c.n) k(k)
  WHERE u.u % 4 <> 0
) s
ORDER BY s.at, s.u, s.f, s.k`;
}
