// Сидер синтетических данных для замера планов запросов (EXPLAIN ANALYZE) на
// живом Postgres. Объёмы и распределения — в seed-profile.ts.
//
// Почему чистый SQL через `pg`, а не Prisma: миллионы строк через ORM —
// минуты, а `INSERT … SELECT … generate_series` — секунды. Данные
// ДЕТЕРМИНИРОВАНЫ: никакого random(), только арифметика от номера строки, —
// два прогона дают одни и те же данные, а значит, сравнимые планы. (Даты
// отсчитываются от момента запуска, так что между разными сутками сдвигаются
// вместе с «сегодня», как и окна 7/30 дней в самом отчёте.)
//
// Сид идёт в несколько соединений и НЕ атомарен: упавший прогон оставляет
// часть данных, но повторный запуск начинается с чистки своего диапазона.
// В SQL подставляются только константы профиля и значения из самой БД.
import { Pool } from 'pg';
import { PERF_ID_BASE as B, PERF_SEED_MARK } from './seed-profile';
import { BOOKING_CLEANUP_SQL } from './seed-booking';
import { json } from './seed-sql';
import { buildSteps } from './seed-steps';

export { PERF_ID_BASE, PERF_PROFILE } from './seed-profile';

// Таблицы БЕЗ FK на User (каскад их не снесёт) → явный DELETE по диапазону.
// prettier-ignore
const NO_FK_TABLES = ['ClientConceptualization.therapistId', 'UserTask.userId', 'TherapistNote.therapistId', 'TherapistCustomMode.therapistId', 'ModeMap.therapistId'];

// Параллельных соединений: узкое место сида — вставка 2 млн событий, 2,7 млн
// оценок и 2,1 млн строк очереди; они независимы и в параллель укладываются
// в ~половину времени.
const WORKERS = 4;
// Зависят от строк других шагов (читают Rating / TherapyRelation) — вторая волна.
const AFTER = new Set(['AppActivity', 'ClientConceptualization', 'Booking']);

async function inParallel<T>(items: T[], run: (item: T) => Promise<void>) {
  const queue = [...items];
  const worker = async () => {
    try {
      while (queue.length) await run(queue.shift() as T);
    } catch (err) {
      queue.length = 0; // упал один — остальные не берут новые задачи
      throw err;
    }
  };
  const results = await Promise.allSettled(
    Array.from({ length: WORKERS }, worker),
  );
  for (const r of results) if (r.status === 'rejected') throw r.reason;
}

export async function seedPerfHorizon(
  opts: { quiet?: boolean } = {},
): Promise<Record<string, number>> {
  const url = process.env.DATABASE_URL;
  if (!url)
    throw new Error('DATABASE_URL не задан: сидеру нужен живой Postgres');
  // ~8 млн строк в чужую базу — не шутка: боевой URL в окружении разработчика
  // не должен превращать замер в аварию.
  const host = new URL(url).hostname;
  if (
    !['', 'localhost', '127.0.0.1', '[::1]'].includes(host) &&
    process.env.PERF_SEED_ALLOW_REMOTE !== '1'
  ) {
    throw new Error(
      `Сидер не для боевой БД: хост ${host} не локальный (PERF_SEED_ALLOW_REMOTE=1, если так и задумано)`,
    );
  }
  const log = (m: string) => (opts.quiet ? undefined : console.log(m));
  const pool = new Pool({ connectionString: url, max: WORKERS });
  const started = Date.now();
  try {
    const { rows } = await pool.query<{ a: string }>(
      `SELECT to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS') AS a`,
    );
    // Чистка только своего диапазона — повторный прогон даёт те же данные.
    for (const target of NO_FK_TABLES) {
      const [table, col] = target.split('.');
      await pool.query(`DELETE FROM "${table}" WHERE "${col}" >= ${B}`);
    }
    await pool.query(
      `DELETE FROM "AnalyticsEvent" WHERE "userId" IS NULL AND "meta" @> ${json(PERF_SEED_MARK)}`,
    );
    await pool.query(BOOKING_CLEANUP_SQL); // Booking.userId — SET NULL, не каскад
    await pool.query(`DELETE FROM "User" WHERE "id" >= ${B}`); // каскад сносит остальное
    log(`чистка диапазона: ${((Date.now() - started) / 1000).toFixed(1)}с`);

    const steps = Object.entries(buildSteps(`'${rows[0].a}'::timestamp`));
    const all = steps.flatMap(([table, sql]) =>
      [sql].flat().map((statement) => ({ table, statement })),
    );
    const counts: Record<string, number> = {};
    // Волны: User → всё независимое → то, что читает записанное выше.
    const waves = [
      all.filter((s) => s.table === 'User'),
      all.filter((s) => s.table !== 'User' && !AFTER.has(s.table)),
      all.filter((s) => AFTER.has(s.table)),
    ];
    // Вставки одной таблицы — по очереди, параллельны только таблицы: две
    // вставки в Rating вперемешку раскладывали строки по страницам по-разному
    // от прогона к прогону, и history-365d прыгал 378 ↔ 1 465 страниц (#1049).
    for (const wave of waves) {
      const byTable = new Map<string, string[]>();
      for (const { table, statement } of wave) {
        byTable.set(table, [...(byTable.get(table) ?? []), statement]);
      }
      await inParallel([...byTable], async ([table, statements]) => {
        for (const statement of statements) {
          const res = await pool.query(statement);
          counts[table] = (counts[table] ?? 0) + (res.rowCount ?? 0);
        }
      });
    }
    // Счётчики строк (n_live_tup) доезжают из соединений с задержкой и, придя
    // после VACUUM, удвоили бы цифры — сбрасываем их заранее, у каждого.
    await Promise.all(
      Array.from({ length: WORKERS }, () =>
        pool.query('SELECT pg_stat_force_next_flush()'),
      ),
    );
    // Без свежей статистики планировщик слеп, а замер бессмыслен. VACUUM заодно
    // строит карту видимости (как autovacuum на проде) — без неё в плане не
    // бывает index-only scan.
    //
    // Вакуум — ПО ОДНОЙ таблице, в отличие от вставок выше: параллельный VACUUM
    // просит ~41 МБ из /dev/shm, и четыре сразу не влезают в 64 МБ, которые
    // Docker даёт по умолчанию (SQLSTATE 53100 — так упала первая джоба `perf`).
    // Замеру этой памяти нужен мизер, поднимать /dev/shm в CI не нужно —
    // цифры и разбор в docs/PERF_PLANS.md. Цена последовательности — секунда.
    for (const [table] of steps) {
      await pool.query(`VACUUM (ANALYZE) "${table}"`);
    }
    log(`сид + VACUUM ANALYZE: ${((Date.now() - started) / 1000).toFixed(1)}с`);
    const sorted = Object.fromEntries(steps.map(([t]) => [t, counts[t] ?? 0]));
    for (const [table, n] of Object.entries(sorted)) log(`  ${table}: ${n}`);
    return sorted;
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  seedPerfHorizon().then(
    () => process.exit(0),
    (err) => {
      console.error(err);
      process.exit(1);
    },
  );
}
