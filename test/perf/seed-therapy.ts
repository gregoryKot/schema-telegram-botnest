// Кабинет терапевта в синтетике «горизонт роста» поверх связей из
// seed-steps.ts: бывшие клиенты, концептуализации, заметки сессий, задания и
// прохождения теста схем. Читают их сценарии scenarios-therapy.ts: бывший
// терапевт (src/therapy/former-therapist-info.ts), заметки сессий (getNotes) и
// карточка клиента (getClientData).
//
// Форма — как на проде:
//  · бывшие клиенты — своя когорта (id выше основной синтетики, чистка сидера
//    сносит её каскадом): живой связи нет, завершённых — от одной до трёх;
//    каждая шестая — `ended` без причины (дубль пары из миграции
//    20261016100000), у каждой седьмой нет endedAt (завершена до колонки);
//  · у клиента заметок, заданий и прохождений теста тем больше, чем выше его
//    ранг у терапевта: у каждого терапевта есть клиент с тремя годами
//    еженедельных заметок (больше страницы SESSION_NOTES_PAGE), двумя годами
//    ежемесячных прохождений и открытым запросом YSQ;
//  · строки лежат в куче по времени, одной вставкой на таблицу: заметки
//    одного клиента разбросаны по страницам, как пишутся на проде.
// Детерминировано: только арифметика от номера строки и id.
import {
  CLIENT_LEFT,
  THERAPIST_REMOVED,
  THERAPIST_RESIGNED,
} from '../../src/therapy/relation-end-reason';
import { STREAK_TASK_TYPES } from '../../src/therapy/streak-window';
import { YSQ_TASK_TYPE } from '../../src/therapy/ysq-request';
import {
  MODE_IDS,
  PERF_ID_BASE as B,
  PERF_PROFILE as P,
  SCHEMA_IDS,
} from './seed-profile';
import { at1, pick, q, series, strs, tsBack } from './seed-sql';
import { PATH_AFTER, withPathContour } from './seed-path';

type Steps = Record<string, string | string[]>;

export const FORMER_COHORT = {
  base: B + 200_000, // бывшие клиенты: base + 1 … base + clients
  clients: 1_000,
} as const;

/** Читают связи из TherapyRelation — волна AFTER сидера (seed.ts). */
export const THERAPY_AFTER = [
  'ClientConceptualization',
  'TherapistNote',
  'UserTask',
  'YsqResultHistory',
  ...PATH_AFTER,
];

const NOTES_MAX = 156; // три года еженедельных сессий
const TASKS_MAX = 48; // задание раз в две недели — без малого два года
const RETAKES_MAX = 24; // больше take: 20 у карточки клиента
const OWN_TASKS = 60_000; // свои задания клиентов (assignedBy NULL)
// prettier-ignore
const TASK_KINDS = ['custom', 'diary_streak', 'belief_check', 'tracker_streak', 'letter_to_self', 'mode_diary'];
// Шестая — NULL: `ended` без причины.
// prettier-ignore
const REASONS = `(${strs([CLIENT_LEFT, THERAPIST_REMOVED, THERAPIST_RESIGNED, CLIENT_LEFT, THERAPIST_REMOVED])} || ARRAY[NULL]::text[])`;

// Активные пары основной синтетики и ранг клиента у терапевта: B кратно 50, а
// клиенты терапевта — 50 id подряд, поэтому (7·клиент + 3·терапевт) mod 50
// перебирает 0…49 у каждого терапевта.
const PAIRS = `pr AS (
  SELECT "therapistId" AS t, "clientId" AS c, ("clientId" * 7 + "therapistId" * 3) % 50 AS rk
  FROM "TherapyRelation"
  WHERE "status" = 'active' AND "therapistId" BETWEEN ${B + 1} AND ${B + P.therapists}
)`;
// Сколько строк у клиента: степенной перекос по рангу, у ранга 49 — max.
const byRank = (max: number, pow: number, rk = 'pr.rk') =>
  `floor(${max} * power(${rk} / 49.0, ${pow}))::int`;

/**
 * Дописывает кабинет терапевта к шагам сидера: когорту — в волну `User`,
 * завершённые связи — после всех прочих связей (их страницы в куче не
 * сдвигаются), остальное — таблицами волны AFTER.
 */
export function withTherapyContour(a: string, steps: Steps): Steps {
  const add = (table: string, sql: string) => {
    steps[table] = [steps[table] ?? []].flat().concat(sql);
  };
  const day = (offset: string) =>
    `to_char((${a}::date - (${offset})::int)::timestamp, 'YYYY-MM-DD')`;
  const F = FORMER_COHORT;

  add(
    'User',
    `INSERT INTO "User"("id","createdAt","role")
SELECT ${F.base} + k, ${a} - make_interval(days => (400 + k % 300)::int), 'CLIENT'::"UserRole"
FROM generate_series(1::bigint, ${F.clients}::bigint) g(k)`,
  );
  // Отказ от роли у терапевта, который снова THERAPIST, отсеивает isShown в
  // коде, а не в SQL, — план тот же.
  add(
    'TherapyRelation',
    `INSERT INTO "TherapyRelation"("code","urlCode","therapistId","clientId","status","createdAt","endedAt","endReason")
SELECT x.code, x.code, x.t, x.c, 'ended'::"RelationStatus", x.started, x.ended, x.reason
FROM (
  SELECT 'perf-e-' || k || '-' || j AS code, ${B} + 1 + (k * 7 + j * 61) % ${P.therapists} AS t, ${F.base} + k AS c,
    ${a} - make_interval(days => (d.e + 30 + (k * 31 + j * 17) % 300)::int) AS started,
    CASE WHEN (k + j) % 7 <> 0 THEN ${a} - make_interval(days => d.e::int) END AS ended,
    ${REASONS}[1 + (k + j) % 6] AS reason
  FROM generate_series(1::bigint, ${F.clients}::bigint) g(k)
  CROSS JOIN LATERAL generate_series(0::bigint, k % 3) s(j)
  CROSS JOIN LATERAL (SELECT (k * 13 + j * 97) % 700 AS e) d
) x
ORDER BY x.started, x.code`,
  );
  // updatedAt — NOT NULL без DEFAULT (ловушка @updatedAt, CLAUDE.md «Миграции БД»).
  add(
    'ClientConceptualization',
    `INSERT INTO "ClientConceptualization"("therapistId","clientId","schemaIds","modeIds","updatedAt")
SELECT "therapistId", "clientId",
  jsonb_build_array(${at1(SCHEMA_IDS, '"id"')}, ${at1(SCHEMA_IDS, '"id" / 9')}),
  jsonb_build_array(${at1(MODE_IDS, '"id"')}, ${at1(MODE_IDS, '"id" / 9')}), CURRENT_TIMESTAMP
FROM "TherapyRelation" WHERE "therapistId" >= ${B} AND "status" = 'active'`,
  );
  // Сессия раз в неделю, от сегодняшней назад; день недели — свой у клиента.
  add(
    'TherapistNote',
    `WITH ${PAIRS}
INSERT INTO "TherapistNote"("therapistId","clientId","date","text","createdAt")
SELECT pr.t, pr.c, ${day('s.d')}, 'perf note ' || w.w,
  ${a} - make_interval(days => s.d::int, secs => ((pr.c + w.w) * 104729 % 3600)::int)
FROM pr
CROSS JOIN LATERAL generate_series(0, ${byRank(NOTES_MAX, 4)} - 1) w(w)
CROSS JOIN LATERAL (SELECT w.w * 7 + pr.c % 7 AS d) s
ORDER BY s.d DESC, pr.t, pr.c`,
  );
  // Задания терапевта (свежее — в работе), его запрос YSQ — открытый у пятой
  // части клиентов, выполненный ещё у пятой, — и свои задания клиентов.
  add(
    'UserTask',
    `WITH ${PAIRS}
INSERT INTO "UserTask"("userId","assignedBy","type","text","targetDays","done","completedAt","createdAt")
SELECT s.uid, s.by, s.kind, s.txt, CASE WHEN s.kind = ANY(${strs(STREAK_TASK_TYPES)}) THEN 7 END,
  s.done, CASE WHEN s.done IS NOT NULL THEN s.at + interval '6 days' END, s.at
FROM (
  SELECT pr.c AS uid, pr.t AS by, ${at1(TASK_KINDS, 'pr.c + j.j')} AS kind, 'perf task ' || j.j AS txt,
    CASE WHEN j.j > 0 THEN j.j % 4 <> 1 END AS done, ${a} - make_interval(days => (j.j * 14 + pr.c % 14)::int) AS at
  FROM pr CROSS JOIN LATERAL generate_series(0, ${byRank(TASKS_MAX, 3)} - 1) j(j)
  UNION ALL
  SELECT pr.c, pr.t, ${q(YSQ_TASK_TYPE)}, 'perf ysq', CASE WHEN pr.rk % 5 = 2 THEN true END,
    ${a} - make_interval(days => (3 + pr.c % 20)::int)
  FROM pr WHERE pr.rk % 5 IN (2, 4)
  UNION ALL
  SELECT ${pick('g.i', 8)}, NULL, ${at1(TASK_KINDS, 'g.i')}, 'perf own ' || g.i,
    CASE WHEN g.i % 3 > 0 THEN g.i % 3 = 1 END, ${tsBack(a, 'g.i', 365)}
  FROM ${series(OWN_TASKS)}
) s
ORDER BY s.at, s.uid, s.kind, s.txt`,
  );
  // Тест — раз в месяц; у клиента двух терапевтов — по старшему рангу.
  add(
    'YsqResultHistory',
    `WITH ${PAIRS}, cl AS (SELECT c, max(rk) AS rk FROM pr GROUP BY c)
INSERT INTO "YsqResultHistory"("userId","answers","completedAt")
SELECT cl.c, (SELECT jsonb_agg(1 + (cl.c + r.r + k) % 6) FROM generate_series(1, 116) k),
  ${a} - make_interval(days => (r.r * 30 + cl.c % 30)::int, secs => (cl.c * 104729 % 86400)::int)
FROM cl CROSS JOIN LATERAL generate_series(0, ${byRank(RETAKES_MAX, 6, 'cl.rk')} - 1) r(r)
ORDER BY r.r * 30 + cl.c % 30 DESC, cl.c`,
  );
  return withPathContour(a, steps);
}
