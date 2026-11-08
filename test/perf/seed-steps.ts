// Шаги сидера синтетики (test/perf/seed.ts): таблица → SQL вставки. Вынесено
// из seed.ts по правилу №10: там чистка диапазона, волны и VACUUM, здесь —
// только билдер. Объёмы — seed-profile.ts, кирпичи SQL — seed-sql.ts. Билдер
// замыкается на момент запуска (`a`): все даты отсчитываются от него.
import { NEED_IDS } from '../../src/bot/bot.service';
import {
  DEFAULT_SECTIONS,
  EMOTION_IDS,
  eventPlan,
  MODE_IDS,
  PERF_ID_BASE as B,
  PERF_PROFILE as P,
  PERF_SEED_MARK,
  PHRASE_MARKS,
  SCHEMA_IDS,
  TIMEZONES,
} from './seed-profile';
import { at1, distinctUser, json, pick, q, series, strs } from './seed-sql';
import { scheduledNotificationSql } from './seed-notifications';
import { webSessionSql } from './seed-sessions';
import { withStreakCohort } from './seed-streaks';

const U = P.users;
const T = P.therapists;
const NEEDS: readonly string[] = NEED_IDS;

// Таблица → SQL вставки (или несколько). Порядок ключей = порядок выполнения.
export function buildSteps(a: string): Record<string, string | string[]> {
  // Момент в прошлом внутри days дней; секунды — чтобы не все строки в полночь.
  const ts = (i: string, days: number) =>
    `(${a} - make_interval(days => ((${i} * 7907) % 1000003 % ${days})::int, secs => ((${i} * 104729) % 86400)::int))`;
  const day = (offset: string) =>
    `to_char((${a}::date - (${offset})::int)::timestamp, 'YYYY-MM-DD')`;

  // meta: смешанная система счисления — значения ключей независимы друг от
  // друга; анонимные строки (userId NULL) помечены PERF_SEED_MARK для чистки.
  const eventSql = (s: ReturnType<typeof eventPlan>[number]) => {
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
  ${meta} AS meta, ${ts('g.i', P.eventSpreadDays)} AS at FROM ${series(s.rows)}) t`;
  };

  return withStreakCohort(a, {
    // ── User: возраст аккаунта размазан по году; доли — как читает /stats ──
    User: `INSERT INTO "User"("id","createdAt","role","therapistMode","disclaimerAccepted","notifyEnabled","botBlockedAt","notifyTimezone","onboardingV2Done","addressForm","themePref","defaultSection")
SELECT ${B} + u,
  ${a} - make_interval(days => ((u * 7919) % ${P.userSpreadDays})::int, secs => ((u * 104729) % 86400)::int),
  (CASE WHEN u <= ${T} THEN 'THERAPIST' ELSE 'CLIENT' END)::"UserRole",
  u <= ${T}, (u % 20) < 17, (u % 8) <> 0,
  CASE WHEN u % 20 = 7 THEN ${a} - interval '10 days' END,
  ${at1(TIMEZONES, 'u / 7')}, (u % 5) < 3,
  (ARRAY['ty','ty','ty','ty','ty','ty','vy','vy','vy',NULL])[1 + (u / 10) % 10],
  (ARRAY['light','light','light','dark','dark',NULL,NULL,NULL,NULL,NULL])[1 + (u / 100) % 10],
  (${strs(DEFAULT_SECTIONS)} || ARRAY[NULL,NULL]::text[])[1 + (u / 1000) % 10]
FROM generate_series(1::bigint, ${U}::bigint) g(u)`,

    // ── Rating: у каждого своё число дней, окно кончается не у всех сегодня ─
    // Дни не раньше регистрации (age); половина людей активна сегодня, остальные
    // «отпали» на 0..59 дней назад — иначе окна 7/30 дней совпали бы с таблицей.
    Rating: `WITH up AS (
  SELECT u, age, LEAST(CASE WHEN u % 10 < 5 THEN 0 ELSE (u * 31) % 60 END, age) AS off
  FROM (SELECT u, (u * 7919) % ${P.userSpreadDays} AS age FROM generate_series(1::bigint, ${U}::bigint) g(u)) a
), nd AS (
  SELECT u, off, LEAST(1 + floor(${P.ratingDaysScale} * power(((u * 4999) % ${U}) / ${U}.0, 4))::bigint, age - off + 1) AS n
  FROM up
)
INSERT INTO "Rating"("userId","date","needId","value")
SELECT ${B} + nd.u, ${day('nd.off + d.d')}, n.need, 1 + (nd.u * 31 + d.d * 17 + n.ord * 7) % 10
FROM nd
CROSS JOIN LATERAL generate_series(0::bigint, nd.n - 1) d(d)
CROSS JOIN unnest(${strs(NEEDS)}) WITH ORDINALITY n(need, ord)`,
    // Один день активности = одна (userId, date), как пишет бот; читает ретеншен D1/D7/D30.
    AppActivity: `INSERT INTO "AppActivity"("userId","date")
SELECT "userId", "date" FROM "Rating" WHERE "userId" >= ${B} AND "needId" = ${q(NEEDS[0])}`,

    AnalyticsEvent: eventPlan().map(eventSql),

    // ── Дневники и упражнения (тексты — заглушки, шифрование не нужно) ─────
    SchemaDiaryEntry: `INSERT INTO "SchemaDiaryEntry"("userId","createdAt","trigger","emotions","thoughts","bodyFeelings","actualBehavior","schemaIds","healthyView")
SELECT ${pick('g.i', 1)}, ${ts('g.i', 365)}, 'perf trigger ' || g.i,
  jsonb_build_array(jsonb_build_object('id', ${at1(EMOTION_IDS, 'g.i')}, 'intensity', 1 + g.i % 10)),
  'perf thoughts', 'perf body', 'perf behavior',
  jsonb_build_array(${at1(SCHEMA_IDS, 'g.i')}, ${at1(SCHEMA_IDS, 'g.i / 9')}), 'perf healthy'
FROM ${series(P.schemaDiary)}`,
    ModeDiaryEntry: `INSERT INTO "ModeDiaryEntry"("userId","createdAt","modeId","situation","thoughts","feelings","healthyResponse")
SELECT ${pick('g.i', 2)}, ${ts('g.i', 365)}, ${at1(MODE_IDS, 'g.i')}, 'perf situation ' || g.i,
  'perf thoughts', 'perf feelings', CASE WHEN g.i % 3 = 0 THEN 'perf healthy' END
FROM ${series(P.modeDiary)}`,
    // unique(userId, date): номер строки раскладывается на (человек, день) без повторов.
    GratitudeDiaryEntry: `INSERT INTO "GratitudeDiaryEntry"("userId","date","items","createdAt")
SELECT ${B} + 1 + (((g.i - 1) % ${U}) * 4999) % ${U}, ${day(`(g.i - 1) / ${U}`)},
  jsonb_build_array('perf one ' || g.i, 'perf two'), ${a} - make_interval(days => ((g.i - 1) / ${U})::int)
FROM ${series(P.gratitudeDiary)}`,
    UserPractice: `INSERT INTO "UserPractice"("userId","needId","text","createdAt")
SELECT ${pick('g.i', 3)}, ${at1(NEEDS, 'g.i')}, 'perf practice ' || g.i, ${ts('g.i', 365)}
FROM ${series(P.userPractice)}`,
    // 5 потребностей на человека: людей childhoodRating / 5, разных.
    ChildhoodRating: `INSERT INTO "ChildhoodRating"("userId","needId","value")
SELECT ${distinctUser('g.i')}, n.need, 1 + (g.i * 7 + n.ord * 3) % 10
FROM ${series(P.childhoodRating / NEEDS.length)}
CROSS JOIN unnest(${strs(NEEDS)}) WITH ORDINALITY n(need, ord)`,
    YsqResult: `INSERT INTO "YsqResult"("userId","answers","completedAt")
SELECT ${distinctUser('g.i')}, (SELECT jsonb_agg(1 + (g.i + k) % 6) FROM generate_series(1, 116) k), ${ts('g.i', 365)}
FROM ${series(P.ysqResult)}`,
    YsqProgress: `INSERT INTO "YsqProgress"("userId","answers","page","updatedAt")
SELECT ${distinctUser('g.i', 3001)}, (SELECT jsonb_agg(1 + (g.i + k) % 6) FROM generate_series(1, 40) k), 1 + g.i % 12, ${ts('g.i', 60)}
FROM ${series(P.ysqProgress)}`,
    UserFlashcard: `INSERT INTO "UserFlashcard"("userId","modeId","needId","reflection","action","createdAt")
SELECT ${pick('g.i', 4)}, ${at1(MODE_IDS, 'g.i')}, ${at1(NEEDS, 'g.i / 9')}, 'perf reflection', 'perf action', ${ts('g.i', 365)}
FROM ${series(P.userFlashcard)}`,
    UserBeliefCheck: `INSERT INTO "UserBeliefCheck"("userId","belief","evidenceFor","evidenceAgainst","reframe","createdAt")
SELECT ${pick('g.i', 5)}, 'perf belief ' || g.i, 'perf for', 'perf against', CASE WHEN g.i % 2 = 0 THEN 'perf reframe' END, ${ts('g.i', 365)}
FROM ${series(P.userBeliefCheck)}`,
    UserPhraseCheck: `INSERT INTO "UserPhraseCheck"("userId","phrase","marks","rewrite","inWarmWords","createdAt")
SELECT ${pick('g.i', 6)}, 'perf phrase ' || g.i, jsonb_build_array(${at1(PHRASE_MARKS, 'g.i')}, ${at1(PHRASE_MARKS, 'g.i / 9')}),
  'perf rewrite', g.i % 3 = 0, ${ts('g.i', 365)}
FROM ${series(P.userPhraseCheck)}`,
    UserLetter: `INSERT INTO "UserLetter"("userId","text","createdAt")
SELECT ${pick('g.i', 7)}, 'perf letter ' || g.i, ${ts('g.i', 365)}
FROM ${series(P.userLetter)}`,
    UserSafePlace: `INSERT INTO "UserSafePlace"("userId","description","updatedAt")
SELECT ${distinctUser('g.i', 3001)}, 'perf place', ${ts('g.i', 365)}
FROM ${series(P.userSafePlace)}`,

    // ── Терапевтский контур: первые T пользователей — терапевты ────────────
    // Клиент — не терапевт; 200 человек получаются клиентами двух терапевтов
    // (50 × 200 = 10 000 пар на 9 800 клиентов) — допустимо: unique по code и активной паре (терапевт, клиент).
    TherapyRelation: [
      // urlCode явно: случайный DEFAULT на 10 000 строк ловил дубли (#1030); синтетика детерминирована (№28).
      `INSERT INTO "TherapyRelation"("code","urlCode","therapistId","clientId","status","createdAt","meetingDays","nextSession","therapyStartDate")
SELECT 'perf-a-' || t || '-' || k, 'perf-a-' || t || '-' || k, ${B} + t, ${B} + ${T} + 1 + ((t - 1) * ${P.clientsPerTherapist} + k) % ${U - T},
  'active'::"RelationStatus", ${a} - make_interval(days => ((t * 31 + k * 17) % 300)::int),
  '[1,4]'::jsonb, ${day('-(k % 14)')}, ${day('(t * 31 + k * 17) % 300')}
FROM generate_series(1::bigint, ${T}::bigint) t, generate_series(0::bigint, ${P.clientsPerTherapist - 1}::bigint) k`,
      `INSERT INTO "TherapyRelation"("code","urlCode","therapistId","clientId","status","createdAt")
SELECT 'perf-p-' || g.i, 'perf-p-' || g.i, ${B} + 1 + g.i % ${T}, NULL, 'pending'::"RelationStatus", ${ts('g.i', 90)}
FROM ${series(P.pendingRelations)}`,
    ],
    // updatedAt — NOT NULL без DEFAULT (ловушка @updatedAt, CLAUDE.md «Миграции БД»).
    ClientConceptualization: `INSERT INTO "ClientConceptualization"("therapistId","clientId","schemaIds","modeIds","updatedAt")
SELECT "therapistId", "clientId",
  jsonb_build_array(${at1(SCHEMA_IDS, '"id"')}, ${at1(SCHEMA_IDS, '"id" / 9')}),
  jsonb_build_array(${at1(MODE_IDS, '"id"')}, ${at1(MODE_IDS, '"id" / 9')}), CURRENT_TIMESTAMP
FROM "TherapyRelation" WHERE "therapistId" >= ${B} AND "status" = 'active'`,
    // ── Очередь уведомлений: год истории + завтрашнее (seed-notifications.ts) ─
    ScheduledNotification: scheduledNotificationSql(a),
    WebSession: webSessionSql(a), // сессии сайта под гвард Bearer (seed-sessions.ts)
  });
}
