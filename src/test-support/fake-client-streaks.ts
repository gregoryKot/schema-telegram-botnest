// Эмуляция сырого запроса стрика клиентов (src/bot/client-streaks.ts) для
// фейковых Prisma: юнит-спеков сервиса обзора и e2e-фейка
// (test/e2e-support/fake-prisma.ts). Семантику SQL доказывает живой спек
// test/raw-sql-live-infra.e2e-spec.ts (правило №18); здесь — та же формула на
// JS, чтобы фейковые прогоны списка клиентов видели настоящие стрики, а не
// заглушку «0» (заглушка развела бы фейк с реальностью на зелёных тестах).
//
// Любой другой сырой SELECT — громкая ошибка, как в fake-cron-lease.ts.

interface RatingDay {
  userId: bigint;
  date: string;
}

interface SqlLike {
  strings?: readonly string[];
  values?: readonly unknown[];
}

const DAY = 86_400_000;
const back = (today: string, n: number) =>
  new Date(Date.parse(`${today}T00:00:00Z`) - n * DAY)
    .toISOString()
    .slice(0, 10);

/** Строки ответа запроса: стрик по `today` клиента и max(date). */
export function clientStreakRows(
  ratings: readonly RatingDay[],
  ids: readonly bigint[],
  todays: readonly string[],
) {
  return ids.map((userId, i) => {
    const today = todays[i];
    const days = new Set(
      ratings.filter((r) => r.userId === userId).map((r) => r.date),
    );
    const lastDate = days.size ? [...days].sort().at(-1)! : null;
    let streak = 0;
    while (days.has(back(today, streak))) streak++;
    return { userId, lastDate, streak };
  });
}

/** Делегат `$queryRaw` фейка: `ratings()` — текущие строки таблицы Rating. */
export function makeFakeQueryRaw(ratings: () => readonly RatingDay[]) {
  return jest.fn((query: SqlLike) => {
    const sql = (query?.strings ?? []).join('?');
    if (!sql.includes('"Rating"') || !sql.includes('unnest(')) {
      return Promise.reject(
        new Error(`fake prisma: неэмулируемый $queryRaw: ${sql.trim()}`),
      );
    }
    const [ids, todays] = (query.values ?? []) as [bigint[], string[]];
    return Promise.resolve(clientStreakRows(ratings(), ids, todays));
  });
}
