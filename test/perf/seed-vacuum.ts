import type { Pool } from 'pg';

// Без свежей статистики планировщик слеп; VACUUM заодно строит карту видимости
// (как autovacuum на проде) — без неё не бывает index-only scan. По одной
// таблице: параллельный VACUUM не влезает в 64 МБ /dev/shm Docker (SQLSTATE
// 53100). Статистика — по всей таблице, а не по случайной выборке: на выборке
// запрос с двумя равноценными планами мигает между ними (docs/PERF_PLANS.md).
export async function vacuumAnalyze(pool: Pool, tables: readonly string[]) {
  const c = await pool.connect();
  try {
    await c.query('SET default_statistics_target = 10000');
    for (const t of tables) await c.query(`VACUUM (ANALYZE) "${t}"`);
  } finally {
    c.release();
  }
}
