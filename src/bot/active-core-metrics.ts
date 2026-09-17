// «Активное ядро» продукта (docs/LAUNCH_STRATEGY.md §5, правило №8 CLAUDE.md):
// пользователи, ведущие дневник настроения минимум 3 разных календарных дня
// за последние 7. Это North Star метрика запуска — без строки в /stats её
// нечем мерить.
//
// Чистая функция, а не отдельный запрос к БД: getAdminStats в
// bot.analytics.service.ts уже тянет пары (userId, date) за последние 30 дней
// для bestDow (fillsByDow) — здесь тот же список сужается до последних 7 дней
// и группируется. Один источник данных, не вторая механика подсчёта
// (правило «одна механика — один компонент»); ноль дополнительных походов в БД.
//
// Файл отдельный от bot.analytics.service.ts — этот файл уже на потолке
// файлового храповика (правило №10), новый код туда не добавляется без нужды.

export interface UserDatePair {
  userId: bigint;
  date: string; // 'YYYY-MM-DD'
}

/**
 * Сколько разных пользователей встречаются в `rows` минимум `minDays` разных
 * календарных дней, начиная с `sinceDate` (включительно, сравнение строк
 * 'YYYY-MM-DD' — работает как хронологическое). Считаем РАЗНЫЕ ДНИ, а не
 * число записей: несколько записей одного пользователя в один день — это
 * один день, не несколько.
 */
export function countActiveCore(
  rows: UserDatePair[],
  sinceDate: string,
  minDays = 3,
): number {
  const daysByUser = new Map<string, Set<string>>();
  for (const row of rows) {
    if (row.date < sinceDate) continue;
    const key = String(row.userId);
    let days = daysByUser.get(key);
    if (!days) {
      days = new Set();
      daysByUser.set(key, days);
    }
    days.add(row.date);
  }
  let count = 0;
  for (const days of daysByUser.values()) {
    if (days.size >= minDays) count++;
  }
  return count;
}
