// Путь клиента в синтетике: путь у каждой активной пары основной синтетики,
// фаз — от 8 до 20 по рангу клиента у терапевта. Читает его сценарий
// therapist-path (scenarios-therapy.ts).
import { PERF_ID_BASE as B, PERF_PROFILE as P } from './seed-profile';

type Steps = Record<string, string | string[]>;

/** Читают связи из TherapyRelation — волна AFTER сидера (seed.ts). */
export const PATH_AFTER = ['TherapyPath', 'TherapyPathPhase'];

/**
 * Путь и его фазы — одной вставкой: фазам нужен id пути, а таблицы одной волны
 * сидер пишет параллельно. Фазы лежат в куче вперемешку, как пишутся на проде.
 */
export function withPathContour(a: string, steps: Steps): Steps {
  steps.TherapyPath = []; // строки пишет вставка фаз; ключ — ради VACUUM ANALYZE
  steps.TherapyPathPhase = `WITH paths AS (
  INSERT INTO "TherapyPath"("therapistId","clientId","startDate","templateId","updatedAt")
  SELECT "therapistId", "clientId",
    to_char((${a}::date - (30 + "clientId" % 300)::int)::timestamp, 'YYYY-MM-DD'), 'general', CURRENT_TIMESTAMP
  FROM "TherapyRelation"
  WHERE "status" = 'active' AND "therapistId" BETWEEN ${B + 1} AND ${B + P.therapists}
  RETURNING "id", ("clientId" * 7 + "therapistId" * 3) % 50 AS rk
)
INSERT INTO "TherapyPathPhase"("pathId","position","name","goal","weeks","updatedAt")
SELECT paths."id", n.n, 'perf phase ' || n.n, 'perf goal', 4 + n.n % 9, CURRENT_TIMESTAMP
FROM paths CROSS JOIN LATERAL generate_series(0, 7 + paths.rk % 13) n(n)
ORDER BY n.n, paths."id"`;
  return steps;
}
