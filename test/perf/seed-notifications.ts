// Очередь уведомлений в синтетике «горизонт роста» — шаг сидера
// (test/perf/seed.ts). Таблицу никто не чистит: отправленное и снятое остаётся
// навсегда, поэтому объём — это люди × дни с регистрации, а не «очередь на
// сегодня». Читают её очередь (getDue, индекс по sendAt), дневной бюджет
// проактивных (countProactiveInDay, сценарий proactive-budget) и /stats.
//
// Форма, а не только объём, повторяет прод:
//  · у каждого с включёнными уведомлениями (User.notifyEnabled — та же формула,
//    u % 8 <> 0) одно проактивное на местный день, от регистрации (возраст
//    аккаунта — формула createdAt в seed.ts) до завтра включительно;
//  · каждое четвёртое прошлое проактивное снято (cancelledAt, sentAt NULL):
//    заполнение трекера снимает напоминание на сегодня (E13) — такие строки
//    и есть то, что ветка «sentAt IS NULL» бюджета обязана отбросить;
//  · сегодняшнее и завтрашнее стоят в очереди (sentAt и cancelledAt NULL);
//  · каждый третий прошлый день — реактивное (summary и т.п.) после
//    заполнения: его отсекает фильтр по типу;
//  · строки лежат в куче по времени (ORDER BY sendAt), как в проде, где
//    планировщик ставит их на сутки вперёд. Порядок «по людям» разбросал бы
//    окно в 7 дней по всей таблице и мерил бы артефакт сидера.
// Итого ~2,1 млн строк при 10 000 людей. Детерминировано: только арифметика.
import { PERF_ID_BASE as B, PERF_PROFILE as P } from './seed-profile';
import { at1 } from './seed-sql';

const fill = (n: number, s: string): string[] => Array<string>(n).fill(s);
// Проактивное дня: в основном вечернее напоминание; pre_reminder ставит только
// кнопка «Напомню через час» — редкость.
const PROACTIVE_MIX = [
  ...fill(14, 'reminder'),
  ...fill(2, 'weekly'),
  'nudge',
  'lapsing_3',
  'value_recap',
  'pre_reminder',
];
const REACTIVE_MIX = [...fill(3, 'summary'), 'comeback', 'streak_7'];

/** `a` — SQL-выражение момента запуска сидера (timestamp UTC). */
export function scheduledNotificationSql(a: string): string {
  return `INSERT INTO "ScheduledNotification"("userId","sendAt","type","sentAt","cancelledAt")
SELECT ${B} + s.u, s.at, s.type,
  CASE WHEN s.d >= 1 AND NOT s.cancelled THEN s.at + interval '15 seconds' END,
  CASE WHEN s.cancelled THEN s.at - interval '2 hours' END
FROM (
  SELECT u.u, d.d, k.k,
    (${a}::date - d.d::int)::timestamp
      + make_interval(hours => (16 + u.u % 6)::int, mins => (k.k * 25)::int) AS at,
    CASE WHEN k.k = 0 THEN ${at1(PROACTIVE_MIX, 'u.u * 3 + d.d')}
      ELSE ${at1(REACTIVE_MIX, 'u.u + d.d')} END AS type,
    k.k = 0 AND d.d >= 1 AND (u.u * 7 + d.d) % 4 = 0 AS cancelled
  FROM generate_series(1::bigint, ${P.users}::bigint) u(u)
  CROSS JOIN LATERAL generate_series(-1::bigint, (u.u * 7919) % ${P.userSpreadDays}) d(d)
  CROSS JOIN generate_series(0, 1) k(k)
  WHERE u.u % 8 <> 0 AND (k.k = 0 OR (d.d >= 1 AND (u.u + d.d) % 3 = 0))
) s
ORDER BY s.at, s.u, s.k`;
}
