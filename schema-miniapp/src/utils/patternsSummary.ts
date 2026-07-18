// Недельная сводка по дневнику схем (экран «Паттерны», дизайн-макет:
// «Чаще всего звучит — проявлялась N из 7 дней»). Чистая логика отдельно
// от компонента — покрыта тестом (правило CLAUDE.md «Тесты»).

export const SUMMARY_WINDOW_DAYS = 7;

export interface WeekSchemaSummary {
  schemaId: string;
  /** В скольких РАЗНЫХ днях недели схема встретилась в записях */
  days: number;
  windowDays: number;
}

interface DiaryEntryLike {
  createdAt: string;
  schemaIds: string[];
}

/** Топ-схема за последние 7 дней по числу уникальных дней; null — данных нет. */
export function weekSchemaSummary(
  entries: DiaryEntryLike[],
  now: Date = new Date(),
): WeekSchemaSummary | null {
  const from = new Date(now);
  from.setDate(from.getDate() - (SUMMARY_WINDOW_DAYS - 1));
  from.setHours(0, 0, 0, 0);

  const daysBySchema = new Map<string, Set<string>>();
  for (const e of entries) {
    const d = new Date(e.createdAt);
    if (isNaN(d.getTime()) || d < from || d > now) continue;
    const dayKey = e.createdAt.slice(0, 10);
    for (const id of e.schemaIds) {
      let set = daysBySchema.get(id);
      if (!set) {
        set = new Set();
        daysBySchema.set(id, set);
      }
      set.add(dayKey);
    }
  }

  let top: WeekSchemaSummary | null = null;
  for (const [schemaId, days] of daysBySchema) {
    if (!top || days.size > top.days) {
      top = { schemaId, days: days.size, windowDays: SUMMARY_WINDOW_DAYS };
    }
  }
  return top;
}
