import { describe, expect, it } from 'vitest';
import type { TherapistNote } from '../../apiTypes';
import { emptyModeLink } from '../conceptGraph/modeLinks';
import type { TechniqueJournalEntry } from '../conceptGraph/techniqueJournal';
import {
  sessionJournal,
  sessionWorkEntries,
  workFromNames,
  workMarks,
} from './sessionJournal';
import type { SessionWorkEntry, SessionWorkItem } from './types';

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
const note = (id: number, date: string, work: SessionWorkItem[]) =>
  ({
    id,
    date,
    text: '',
    createdAt: `${date}T10:00:00Z`,
    work,
  }) as TherapistNote;
const mark = (day: string, id = 'punitive_critic'): TechniqueJournalEntry => ({
  day,
  techniqueId: 'chairwork',
  from: { kind: 'mode', id },
});

describe('sessionWorkEntries', () => {
  it('показано всё — берётся страница, ответ ручки не нужен', () => {
    const page = {
      notes: [note(2, '2026-11-05', [item()]), note(1, '2026-11-01', [])],
      total: 2,
    };
    const stale: SessionWorkEntry[] = [
      { noteId: 9, date: '2026-10-01', work: [item()] },
    ];
    expect(sessionWorkEntries(page, stale)).toEqual([
      { noteId: 2, date: '2026-11-05', work: [item()] },
    ]);
  });

  it('есть более ранние — добавляются из ручки, показанные не двоятся', () => {
    const page = { notes: [note(2, '2026-11-05', [item()])], total: 3 };
    const older: SessionWorkEntry[] = [
      { noteId: 2, date: '2026-11-05', work: [item({ id: 'old' })] },
      { noteId: 1, date: '2026-01-05', work: [item({ id: 'w0' })] },
    ];
    expect(sessionWorkEntries(page, older).map((e) => e.noteId)).toEqual([
      2, 1,
    ]);
    expect(sessionWorkEntries(page, null).map((e) => e.noteId)).toEqual([2]);
  });
});

describe('sessionJournal', () => {
  const entries: SessionWorkEntry[] = [
    { noteId: 2, date: '2026-11-05', work: [item()] },
    {
      noteId: 3,
      date: '2026-11-07',
      work: [
        item({ id: 'c', kind: 'custom', customName: 'Рисунок', modeIds: [] }),
      ],
    },
  ];

  it('отметка и пункт за тот же день с той же техникой и режимом не двоятся', () => {
    const days = sessionJournal([mark('2026-11-05')], entries);
    expect(days.map((d) => d.day)).toEqual(['2026-11-07', '2026-11-05']);
    expect(days[1].rows).toEqual([
      { source: 'work', day: '2026-11-05', noteId: 2, item: item() },
    ]);
  });

  it('другой день или другой режим — отметка остаётся, пункты стоят первыми', () => {
    const days = sessionJournal(
      [mark('2026-11-05', 'vulnerable_child'), mark('2026-11-06')],
      entries,
    );
    expect(days.map((d) => [d.day, d.rows.map((r) => r.source)])).toEqual([
      ['2026-11-07', ['work']],
      ['2026-11-06', ['mark']],
      ['2026-11-05', ['work', 'mark']],
    ]);
  });

  it('ни отметок, ни пунктов — пусто', () => {
    expect(sessionJournal([], [])).toEqual([]);
  });
});

describe('workFromNames и workMarks', () => {
  it('режим со словами клиента, схема по справочнику, незнакомое пропускается', () => {
    const links = [{ ...emptyModeLink('punitive_critic'), alias: 'Судья' }];
    const it1 = item({ schemaIds: ['abandonment', 'нет такой'] });
    expect(workFromNames(it1, links)).toBe(
      'Судья (Карающий Критик), Покинутость / Нестабильность',
    );
    expect(workFromNames(item({ modeIds: [] }))).toBe('');
    const mine = [{ id: 'cm_5', name: 'Тихий Наблюдатель' }];
    expect(workFromNames(item({ modeIds: ['cm_5', 'cm_6'] }), [], mine)).toBe(
      'Тихий Наблюдатель',
    );
  });

  it('дни техники с этим режимом — только техники и только свои', () => {
    const entries: SessionWorkEntry[] = [
      {
        noteId: 1,
        date: '2026-11-05',
        work: [item(), item({ kind: 'exercise', refId: 'safe' })],
      },
      {
        noteId: 2,
        date: '2026-11-06',
        work: [item({ modeIds: [], schemaIds: ['abandonment'] })],
      },
    ];
    expect(workMarks(entries, { kind: 'mode', id: 'punitive_critic' })).toEqual(
      [{ techniqueId: 'chairwork', day: '2026-11-05' }],
    );
    expect(workMarks(entries, { kind: 'schema', id: 'abandonment' })).toEqual([
      { techniqueId: 'chairwork', day: '2026-11-06' },
    ]);
  });
});
