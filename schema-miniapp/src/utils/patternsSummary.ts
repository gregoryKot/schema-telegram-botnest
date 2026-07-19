// Недельная сводка по дневникам (экран «Паттерны», дизайн-макет:
// «Чаще всего звучит — проявлялась N из 7 дней»). Чистая логика отдельно
// от компонента — покрыта тестом (правило CLAUDE.md «Тесты»).
// Обобщена на схемы (schemaIds: string[]) и режимы (modeId: string).

import type { SchemaDiaryEntry, ModeDiaryEntry } from '../types';

export const SUMMARY_WINDOW_DAYS = 7;

export interface WeekTopSummary {
  id: string;
  /** В скольких РАЗНЫХ днях недели сущность встретилась в записях */
  days: number;
  windowDays: number;
}

interface DatedIds {
  createdAt: string;
  ids: string[];
}

/** Топ-сущность за последние 7 дней по числу уникальных дней; null — данных нет. */
export function weekTopSummary(
  entries: DatedIds[],
  now: Date = new Date(),
): WeekTopSummary | null {
  const from = new Date(now);
  from.setDate(from.getDate() - (SUMMARY_WINDOW_DAYS - 1));
  from.setHours(0, 0, 0, 0);

  const daysById = new Map<string, Set<string>>();
  for (const e of entries) {
    const d = new Date(e.createdAt);
    if (isNaN(d.getTime()) || d < from || d > now) continue;
    const dayKey = e.createdAt.slice(0, 10);
    for (const id of e.ids) {
      let set = daysById.get(id);
      if (!set) {
        set = new Set();
        daysById.set(id, set);
      }
      set.add(dayKey);
    }
  }

  let top: WeekTopSummary | null = null;
  for (const [id, days] of daysById) {
    if (!top || days.size > top.days) {
      top = { id, days: days.size, windowDays: SUMMARY_WINDOW_DAYS };
    }
  }
  return top;
}

export function weekSchemaSummary(
  entries: Pick<SchemaDiaryEntry, 'createdAt' | 'schemaIds'>[],
  now: Date = new Date(),
): WeekTopSummary | null {
  return weekTopSummary(
    entries.map((e) => ({ createdAt: e.createdAt, ids: e.schemaIds })),
    now,
  );
}

export function weekModeSummary(
  entries: Pick<ModeDiaryEntry, 'createdAt' | 'modeId'>[],
  now: Date = new Date(),
): WeekTopSummary | null {
  return weekTopSummary(
    entries.map((e) => ({ createdAt: e.createdAt, ids: [e.modeId] })),
    now,
  );
}
