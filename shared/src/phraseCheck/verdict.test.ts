// Вердикт разбора фразы: чем больше примет критика, тем жёстче диагноз
// ФРАЗЫ — но ни один вариант не переходит на личность («ты плохой»), иначе
// упражнение делает ровно то, от чего лечит.
import { describe, it, expect } from 'vitest';
import { buildVerdict } from './verdict';
import { PHRASE_MARK_IDS } from './criteria';

describe('buildVerdict', () => {
  it('ни одной приметы — это самокоррекция, переписывать нечего', () => {
    const v = buildVerdict([]);
    expect(v.title).toBe('Это самокоррекция');
    expect(v.suggestRewrite).toBe(false);
  });

  it('одна-две приметы — «почти забота», переписать предлагается', () => {
    const v = buildVerdict(['person']);
    expect(v.title).toBe('Почти забота');
    expect(v.suggestRewrite).toBe(true);
    expect(buildVerdict(['person', 'fear']).title).toBe('Почти забота');
  });

  it('от трёх до шести примет — смешанный голос', () => {
    expect(buildVerdict(['person', 'fear', 'worth']).title).toBe(
      'Голос смешанный',
    );
    expect(buildVerdict(PHRASE_MARK_IDS.slice(0, 6)).title).toBe(
      'Голос смешанный',
    );
  });

  it('семь и больше — говорит критик', () => {
    expect(buildVerdict(PHRASE_MARK_IDS.slice(0, 7)).title).toBe(
      'Говорит критик',
    );
    expect(buildVerdict([...PHRASE_MARK_IDS]).title).toBe('Говорит критик');
  });

  it('дубли и незнакомые id не завышают счёт', () => {
    const dup = buildVerdict(['person', 'person', 'person', 'person']);
    expect(dup.title).toBe('Почти забота');
    const junk = buildVerdict(['person', 'выдумка' as never]);
    expect(junk.title).toBe('Почти забота');
  });

  it('порог считается от числа примет, а не от захардкоженной четвёрки', () => {
    // Регрессия: пороги писались под 4 приметы, а таблица содержит 9 —
    // «смешанный» обязан жить между ними, иначе шкала врёт.
    expect(PHRASE_MARK_IDS).toHaveLength(9);
    const titles = PHRASE_MARK_IDS.map(
      (_, i) => buildVerdict(PHRASE_MARK_IDS.slice(0, i + 1)).title,
    );
    expect(new Set(titles).size).toBe(3);
  });

  it('ни один вердикт не переходит на личность читателя', () => {
    const all = [
      buildVerdict([]),
      buildVerdict(['person']),
      buildVerdict(['person', 'fear', 'worth']),
      buildVerdict([...PHRASE_MARK_IDS]),
    ];
    for (const v of all) {
      expect(v.title).not.toMatch(/ты|вы|тебя|вас/i);
      expect(v.text).not.toMatch(/(^|[^а-яё])(ты|вы|тебя|вас)([^а-яё]|$)/i);
    }
  });
});
