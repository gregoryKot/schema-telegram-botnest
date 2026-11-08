// Когорта «долгий стрик» в синтетике горизонта роста — шаг сидера
// (test/perf/seed.ts). Основная синтетика даёт самому активному не больше
// года оценок (`ratingDaysScale`), а стрик списка клиентов терапевта
// (src/bot/client-streaks.ts) обязан выдерживать годы: до 2026-11 он резался
// общим `take: 5000` на всех клиентов (docs/open/backend.md). Здесь отдельный
// терапевт и его клиенты, каждый заполняет трекер каждый день много лет
// подряд, — сценарий `therapist-clients-long-streaks` мерит план на них.
//
// Отдельный диапазон id (выше основной синтетики, но ≥ PERF_ID_BASE — чистка
// сидера сносит его каскадом). Одна потребность в день: стрику нужен день, а
// не пять строк, и /stats от когорты почти не тяжелеет. Пояс клиентов — UTC,
// чтобы «сегодня» клиента совпало с днём сидера. Детерминировано.
import { NEED_IDS } from '../../src/bot/bot.service';
import { PERF_ID_BASE as B } from './seed-profile';
import { q } from './seed-sql';

export const STREAK_COHORT = {
  base: B + 100_000, // терапевт; клиенты — base + 1 … base + clients
  clients: 50,
  days: 2_600, // > 5000 / 2: старый общий потолок резал бы уже двоих
} as const;

const S = STREAK_COHORT;

/**
 * Дописывает когорту к шагам сидера: пользователи — в волну `User`,
 * связи и оценки — во вторую волну (их FK на User уже выполнен).
 */
export function withStreakCohort(
  a: string,
  steps: Record<string, string | string[]>,
): Record<string, string | string[]> {
  const add = (table: string, sql: string) => {
    steps[table] = [steps[table] ?? []].flat().concat(sql);
  };
  add(
    'User',
    `INSERT INTO "User"("id","createdAt","role","therapistMode","notifyTimezone")
SELECT ${S.base} + k, ${a} - interval '${S.days} days',
  (CASE WHEN k = 0 THEN 'THERAPIST' ELSE 'CLIENT' END)::"UserRole", k = 0, 'UTC'
FROM generate_series(0::bigint, ${S.clients}::bigint) g(k)`,
  );
  add(
    'TherapyRelation',
    `INSERT INTO "TherapyRelation"("code","urlCode","therapistId","clientId","status","createdAt")
SELECT 'perf-s-' || k, 'perf-s-' || k, ${S.base}, ${S.base} + k, 'active'::"RelationStatus", ${a} - interval '${S.days} days'
FROM generate_series(1::bigint, ${S.clients}::bigint) g(k)`,
  );
  // Вторая потребность профиля, не первая: AppActivity сидера копирует
  // строки первой, а когорте ретеншен /stats не нужен.
  add(
    'Rating',
    `INSERT INTO "Rating"("userId","date","needId","value")
SELECT ${S.base} + k, to_char((${a}::date - d::int)::timestamp, 'YYYY-MM-DD'), ${q(NEED_IDS[1])}, 1 + (k + d) % 10
FROM generate_series(1::bigint, ${S.clients}::bigint) g(k)
CROSS JOIN generate_series(0::bigint, ${S.days - 1}::bigint) s(d)`,
  );
  return steps;
}
