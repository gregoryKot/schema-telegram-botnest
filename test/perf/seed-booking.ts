// Запись из приложения (#546) в синтетике «горизонт роста» — шаги сидера
// (test/perf/seed-steps.ts). Читает её GET /api/client-booking
// (`ClientBookingService.overview`, src/booking/client-booking.service.ts):
// владелец практики по ADMIN_ID через AuthProvider, активная связь клиента с
// ним и ближайшие брони клиента по индексу (userId, startsAt) — сценарий
// `client-booking` в scenarios.ts.
//
// Форма повторяет прод, а не только объём:
//  · владелец практики — первый терапевт синтетики (PRACTICE_OWNER), его
//    Telegram id лежит в AuthProvider, как у владельца, вошедшего в мини-апп;
//  · телеграм-вход у трёх из четырёх людей, Google — у каждого десятого
//    (AuthProvider читают ещё очередь уведомлений и /stats);
//  · брони с аккаунтом — только у клиентов владельца (календарь в системе
//    один, его): сессия раз в неделю, от 8 до 104 недель назад и 4 недели
//    вперёд; прошлые — CONFIRMED/COMPLETED, каждая шестая CANCELLED; будущие —
//    вперемешку CONFIRMED, CANCELLED и HELD с истёкшим холдом (его отбрасывает
//    фильтр overview);
//  · брони публичной формы без аккаунта (userId NULL) — за два года;
//  · ни одна бронь не стоит сегодня: что «после now», не зависит от часа прогона;
//  · строки лежат в куче по времени сессии, одной вставкой: две параллельные
//    вставки перемешали бы страницы от прогона к прогону.
// Booking.userId — SET NULL, а не каскад: чистка сидера сносит брони по
// префиксу cancelToken (BOOKING_CLEANUP_SQL). Детерминировано: только арифметика.
import { PERF_ID_BASE as B, PERF_PROFILE as P } from './seed-profile';

/** Telegram id синтетики: userId + TG_BASE, в диапазоне настоящих (1e9–1e10). */
const TG_BASE = 7_000_000_000;
const GUEST_BOOKINGS = 1_500;
const TOKEN = 'perf-b-';

export const PRACTICE_OWNER = {
  userId: B + 1,
  telegramId: TG_BASE + 1,
} as const;

export const BOOKING_CLEANUP_SQL = `DELETE FROM "Booking" WHERE "cancelToken" LIKE '${TOKEN}%'`;

/** `a` — SQL-выражение момента запуска сидера (timestamp UTC). */
export function authProviderSql(a: string): string {
  const since = `${a} - make_interval(days => ((u * 7919) % ${P.userSpreadDays})::int)`;
  return `INSERT INTO "AuthProvider"("userId","provider","providerId","createdAt")
SELECT ${B} + u, 'telegram', (${TG_BASE} + u)::text, ${since}
FROM generate_series(1::bigint, ${P.users}::bigint) g(u) WHERE u % 4 <> 0
UNION ALL
SELECT ${B} + u, 'google', 'perf-google-' || u, ${since}
FROM generate_series(1::bigint, ${P.users}::bigint) g(u) WHERE u % 10 = 3`;
}

/** Брони: клиенты владельца — из его активных связей (вторая волна сидера). */
export function bookingSql(a: string): string {
  const at = (days: string, salt: string) =>
    `(${a}::date - (${days})::int)::timestamp + make_interval(hours => (10 + (${salt}) % 9)::int)`;
  return `INSERT INTO "Booking"("startsAt","durationMin","type","status","heldUntil","clientName","clientContact","clientChannel","userId","cancelToken","source","amount","createdAt","updatedAt")
SELECT s.at, s.dur, s.type::"SessionType", s.status::"BookingStatus",
  CASE WHEN s.status = 'HELD' THEN ${a} - interval '1 hour' END,
  s.name, 'perf contact', s.channel, s.uid, s.token, s.source,
  CASE WHEN s.dur = 50 THEN 5000 END, s.at - interval '3 days', CURRENT_TIMESTAMP
FROM (
  SELECT ${at('w.w * 7', 'r."clientId"')} AS at, 50 AS dur, 'SESSION_50' AS type,
    CASE WHEN w.w < 0 THEN (ARRAY['CONFIRMED','CANCELLED','HELD','CONFIRMED'])[1 + (r."clientId" - w.w) % 4]
      WHEN (r."clientId" + w.w) % 6 = 0 THEN 'CANCELLED'
      WHEN w.w % 3 = 0 THEN 'COMPLETED' ELSE 'CONFIRMED' END AS status,
    'perf client' AS name, 'telegram' AS channel, r."clientId" AS uid,
    '${TOKEN}' || r."clientId" || '-' || w.w AS token, 'perf app' AS source
  FROM "TherapyRelation" r
  CROSS JOIN LATERAL generate_series(-4, 8 + (r."clientId" % 97)::int) w(w)
  WHERE r."therapistId" = ${PRACTICE_OWNER.userId} AND r."status" = 'active' AND w.w <> 0
  UNION ALL
  SELECT ${at('1 + g.i % 730', 'g.i')}, CASE WHEN g.i % 5 = 0 THEN 15 ELSE 50 END,
    CASE WHEN g.i % 5 = 0 THEN 'INTRO_15' ELSE 'SESSION_50' END,
    CASE WHEN g.i % 7 = 0 THEN 'CANCELLED' ELSE 'CONFIRMED' END,
    'perf guest', NULL, NULL, '${TOKEN}guest-' || g.i, 'perf site'
  FROM generate_series(1::bigint, ${GUEST_BOOKINGS}::bigint) g(i)
) s
ORDER BY s.at, s.token`;
}
