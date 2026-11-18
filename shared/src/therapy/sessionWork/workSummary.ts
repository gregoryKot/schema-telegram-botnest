// Сводка «Что было сделано» на «Обзоре» карточки клиента (#1330): считается по
// журналу sessionJournal, поэтому пункт итогов и отметка «Делали сегодня» за
// один день не двоятся. «Раз» — день: два пункта одной техники в один день —
// один раз. Чистые функции без React.
import type { SessionJournalDay } from './sessionJournal';
import { workTitle } from './names';
import type { SessionWorkItem, SessionWorkKind } from './types';

export interface WorkSummaryRow {
  /** Устойчивый ключ строки: вид + id техники или упражнения, у «своего» — название. */
  key: string;
  kind: SessionWorkKind;
  title: string;
  /** Сколько дней это делали. */
  count: number;
  /** Последний день, `YYYY-MM-DD`. */
  lastDay: string;
}

export interface WorkSummaryTarget {
  id: string;
  count: number;
}

export interface WorkSummary {
  /** Что делали: недавнее сверху, при равном дне — чаще выше. */
  done: WorkSummaryRow[];
  /** С чем работали: чаще — выше; при равном счёте — в порядке появления в журнале. */
  modes: WorkSummaryTarget[];
  schemas: WorkSummaryTarget[];
  needs: WorkSummaryTarget[];
}

type Part = Pick<
  SessionWorkItem,
  'kind' | 'refId' | 'customName' | 'modeIds' | 'schemaIds' | 'needIds'
>;

const NO_IDS: string[] = [];

/** Дни по ключу, в порядке первого появления ключа. */
class DayCounter {
  private readonly days = new Map<string, Set<string>>();

  add(key: string, day: string) {
    const set = this.days.get(key) ?? new Set<string>();
    set.add(day);
    this.days.set(key, set);
  }

  count(key: string) {
    return this.days.get(key)?.size ?? 0;
  }

  targets(): WorkSummaryTarget[] {
    return [...this.days.keys()]
      .map((id) => ({ id, count: this.count(id) }))
      .sort((a, b) => b.count - a.count);
  }
}

const rowKey = (part: Part, title: string) =>
  part.kind === 'custom'
    ? `custom:${title.toLowerCase()}`
    : `${part.kind}:${part.refId ?? ''}`;

/**
 * Журнал «На сессиях» → сводка. Пункт без названия (техники или упражнения
 * больше нет в каталоге) в «что делали» не попадает, но режимы, схемы и
 * потребности из него считаются. Журнал пуст — пустые списки.
 */
export function workSummary(days: readonly SessionJournalDay[]): WorkSummary {
  const rows = new Map<string, WorkSummaryRow>();
  const done = new DayCounter();
  const modes = new DayCounter();
  const schemas = new DayCounter();
  const needs = new DayCounter();
  for (const { day, rows: dayRows } of days) {
    for (const row of dayRows) {
      const part: Part =
        row.source === 'work'
          ? row.item
          : {
              kind: 'technique',
              refId: row.techniqueId,
              modeIds: row.from.kind === 'mode' ? [row.from.id] : NO_IDS,
              schemaIds: row.from.kind === 'schema' ? [row.from.id] : NO_IDS,
              needIds: NO_IDS,
            };
      for (const id of part.modeIds) modes.add(id, day);
      for (const id of part.schemaIds) schemas.add(id, day);
      for (const id of part.needIds) needs.add(id, day);
      const title = workTitle(part as SessionWorkItem).trim();
      if (!title) continue;
      const key = rowKey(part, title);
      done.add(key, day);
      const prev = rows.get(key);
      if (!prev)
        rows.set(key, { key, kind: part.kind, title, count: 0, lastDay: day });
      else if (day > prev.lastDay) prev.lastDay = day;
    }
  }
  const list = [...rows.values()].map((r) => ({ ...r, count: done.count(r.key) }));
  list.sort((a, b) =>
    a.lastDay < b.lastDay ? 1 : a.lastDay > b.lastDay ? -1 : b.count - a.count,
  );
  return {
    done: list,
    modes: modes.targets(),
    schemas: schemas.targets(),
    needs: needs.targets(),
  };
}

export const isEmptySummary = (s: WorkSummary): boolean =>
  s.done.length + s.modes.length + s.schemas.length + s.needs.length === 0;
