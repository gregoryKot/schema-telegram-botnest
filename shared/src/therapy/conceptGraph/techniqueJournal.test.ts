// Журнал техник (#995): отметки «Делали сегодня» всех связей одним списком —
// новые дни сверху, режимы и схемы вместе, слова клиента из alias режима,
// битые отметки выбрасываются, связей нет — пусто.
import { describe, expect, it } from 'vitest';
import { emptyModeLink } from './modeLinks';
import { emptySchemaLink } from './schemaLinks';
import {
  journalDays,
  journalFromName,
  techniqueJournal,
} from './techniqueJournal';

const mark = (techniqueId: string, day: string) => ({ techniqueId, day });

describe('techniqueJournal', () => {
  it('связей нет или в них нет отметок — пустой журнал', () => {
    expect(techniqueJournal({})).toEqual([]);
    expect(
      techniqueJournal({
        modeLinks: [emptyModeLink('vulnerable_child')],
        schemaLinks: [emptySchemaLink('abandonment')],
      }),
    ).toEqual([]);
  });

  it('режимы и схемы одним списком, новые дни сверху', () => {
    const journal = techniqueJournal({
      modeLinks: [
        {
          ...emptyModeLink('punitive_critic'),
          done: [
            mark('chairwork', '2026-10-30'),
            mark('chairwork', '2026-11-05'),
          ],
        },
      ],
      schemaLinks: [
        {
          ...emptySchemaLink('abandonment'),
          done: [mark('imagery_rescripting', '2026-11-07')],
        },
      ],
    });
    expect(journal).toEqual([
      {
        day: '2026-11-07',
        techniqueId: 'imagery_rescripting',
        from: { kind: 'schema', id: 'abandonment' },
      },
      {
        day: '2026-11-05',
        techniqueId: 'chairwork',
        from: { kind: 'mode', id: 'punitive_critic' },
      },
      {
        day: '2026-10-30',
        techniqueId: 'chairwork',
        from: { kind: 'mode', id: 'punitive_critic' },
      },
    ]);
  });

  it('один день: режимы раньше схем, у одной связи поздняя отметка выше', () => {
    const day = '2026-11-07';
    const journal = techniqueJournal({
      modeLinks: [
        {
          ...emptyModeLink('vulnerable_child'),
          done: [mark('imagery_rescripting', day), mark('chairwork', day)],
        },
      ],
      schemaLinks: [
        { ...emptySchemaLink('abandonment'), done: [mark('chairwork', day)] },
      ],
    });
    expect(journal.map((e) => `${e.from.id}:${e.techniqueId}`)).toEqual([
      'vulnerable_child:chairwork',
      'vulnerable_child:imagery_rescripting',
      'abandonment:chairwork',
    ]);
  });

  it('слова клиента — alias режима без пробелов по краям; пустой alias не попадает', () => {
    const done = [mark('chairwork', '2026-11-07')];
    const [named, plain] = techniqueJournal({
      modeLinks: [
        { ...emptyModeLink('punitive_critic'), alias: '  Судья ', done },
        { ...emptyModeLink('vulnerable_child'), alias: '   ', done },
      ],
    });
    expect(named.alias).toBe('Судья');
    expect('alias' in plain).toBe(false);
  });

  it('битые отметки и повтор того же дня выбрасываются', () => {
    const journal = techniqueJournal({
      modeLinks: [
        {
          ...emptyModeLink('punitive_critic'),
          done: [
            mark('chairwork', '2026-11-07'),
            mark('chairwork', '2026-11-07'),
            mark('chairwork', '7 ноября'),
            mark('', '2026-11-06'),
          ],
        },
      ],
    });
    expect(journal).toHaveLength(1);
  });
});

describe('journalFromName', () => {
  const entry = (
    from: { kind: 'mode' | 'schema'; id: string },
    alias?: string,
  ) => ({
    day: '2026-11-07',
    techniqueId: 'chairwork',
    from,
    ...(alias ? { alias } : {}),
  });

  it('название из справочника; у режима со словами клиента — как в «Коротко»', () => {
    expect(
      journalFromName(entry({ kind: 'mode', id: 'punitive_critic' })),
    ).toBe('Карающий Критик');
    expect(
      journalFromName(entry({ kind: 'mode', id: 'punitive_critic' }, 'Судья')),
    ).toBe('Судья (Карающий Критик)');
    expect(journalFromName(entry({ kind: 'schema', id: 'abandonment' }))).toBe(
      'Покинутость / Нестабильность',
    );
  });

  it('нет в справочнике — пусто', () => {
    expect(journalFromName(entry({ kind: 'mode', id: 'nope' }, 'Судья'))).toBe(
      '',
    );
  });
});

describe('journalDays', () => {
  it('день один раз, под ним его техники по порядку журнала; пусто — пусто', () => {
    const e = (day: string, techniqueId: string) => ({
      day,
      techniqueId,
      from: { kind: 'mode' as const, id: 'punitive_critic' },
    });
    const a = e('2026-11-07', 'chairwork');
    const b = e('2026-11-07', 'imagery_rescripting');
    const c = e('2026-11-05', 'chairwork');
    expect(journalDays([a, b, c])).toEqual([
      { day: '2026-11-07', entries: [a, b] },
      { day: '2026-11-05', entries: [c] },
    ]);
    expect(journalDays([])).toEqual([]);
  });
});
