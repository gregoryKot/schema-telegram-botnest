import { describe, expect, it } from 'vitest';
import type { TechniqueJournalEntry } from '../conceptGraph/techniqueJournal';
import { sessionJournal } from './sessionJournal';
import type { SessionWorkEntry, SessionWorkItem } from './types';
import { isEmptySummary, workSummary } from './workSummary';

const item = (over: Partial<SessionWorkItem> = {}): SessionWorkItem => ({
  id: 'w1',
  kind: 'technique',
  refId: 'chairwork',
  modeIds: ['punitive_critic'],
  schemaIds: [],
  needIds: [],
  fields: {},
  ...over,
});
const entry = (
  noteId: number,
  date: string,
  work: SessionWorkItem[],
): SessionWorkEntry => ({ noteId, date, work });
const mark = (
  day: string,
  techniqueId: string,
  kind: 'mode' | 'schema',
  id: string,
): TechniqueJournalEntry => ({ day, techniqueId, from: { kind, id } });

const sum = (marks: TechniqueJournalEntry[], entries: SessionWorkEntry[]) =>
  workSummary(sessionJournal(marks, entries));

describe('workSummary', () => {
  it('пустой журнал — пустая сводка', () => {
    const s = sum([], []);
    expect(s).toEqual({ done: [], modes: [], schemas: [], needs: [] });
    expect(isEmptySummary(s)).toBe(true);
  });

  it('считает дни и последний день; недавнее сверху', () => {
    const s = sum(
      [],
      [
        entry(1, '2026-11-01', [item()]),
        entry(2, '2026-11-08', [item({ id: 'w2' })]),
        entry(3, '2026-11-10', [
          item({ kind: 'exercise', refId: 'belief', modeIds: [] }),
        ]),
      ],
    );
    expect(s.done.map((r) => [r.key, r.count, r.lastDay])).toEqual([
      ['exercise:belief', 1, '2026-11-10'],
      ['technique:chairwork', 2, '2026-11-08'],
    ]);
    expect(s.done.every((r) => r.title.length > 0)).toBe(true);
    expect(isEmptySummary(s)).toBe(false);
  });

  it('пункт итогов и отметка за тот же день не двоятся; отметка с другой схемой в тот же день — тот же раз', () => {
    const s = sum(
      [
        mark('2026-11-08', 'chairwork', 'mode', 'punitive_critic'),
        mark('2026-11-08', 'chairwork', 'schema', 'abandonment'),
        mark('2026-11-02', 'chairwork', 'mode', 'punitive_critic'),
      ],
      [entry(1, '2026-11-08', [item()])],
    );
    expect(s.done).toEqual([
      expect.objectContaining({
        key: 'technique:chairwork',
        count: 2,
        lastDay: '2026-11-08',
      }),
    ]);
    expect(s.modes).toEqual([{ id: 'punitive_critic', count: 2 }]);
    expect(s.schemas).toEqual([{ id: 'abandonment', count: 1 }]);
  });

  it('режимы, схемы и потребности: чаще — выше; два пункта одного дня — один раз', () => {
    const s = sum(
      [],
      [
        entry(1, '2026-11-01', [
          item({ modeIds: ['vulnerable_child'], needIds: ['safety'] }),
          item({
            id: 'w2',
            modeIds: ['vulnerable_child', 'punitive_critic'],
            schemaIds: ['abandonment'],
          }),
        ]),
        entry(2, '2026-11-05', [item({ needIds: ['safety'] })]),
      ],
    );
    expect(s.modes).toEqual([
      { id: 'punitive_critic', count: 2 },
      { id: 'vulnerable_child', count: 1 },
    ]);
    expect(s.schemas).toEqual([{ id: 'abandonment', count: 1 }]);
    expect(s.needs).toEqual([{ id: 'safety', count: 2 }]);
    expect(s.done[0].count).toBe(2);
  });

  it('«своё» сводится по названию без учёта регистра; без названия — «Своё»', () => {
    const custom = (id: string, customName?: string) =>
      item({ id, kind: 'custom', refId: undefined, customName, modeIds: [] });
    const s = sum(
      [],
      [
        entry(1, '2026-11-01', [custom('a', 'Рисунок семьи')]),
        entry(2, '2026-11-03', [custom('b', 'рисунок семьи'), custom('c')]),
      ],
    );
    expect(s.done.map((r) => [r.title, r.count])).toEqual([
      ['рисунок семьи', 2], // написание — из последней записи
      ['Своё', 1],
    ]);
  });

  it('техника, которой нет в каталоге, строки не даёт, а режим из неё считается', () => {
    const s = sum([mark('2026-11-02', 'gone', 'mode', 'punitive_critic')], []);
    expect(s.done).toEqual([]);
    expect(s.modes).toEqual([{ id: 'punitive_critic', count: 1 }]);
  });
});
