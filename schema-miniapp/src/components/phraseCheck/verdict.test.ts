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

  it('одна примета — «почти забота», переписать предлагается', () => {
    const v = buildVerdict(['person']);
    expect(v.title).toBe('Почти забота');
    expect(v.suggestRewrite).toBe(true);
  });

  it('две и три приметы — смешанный голос', () => {
    expect(buildVerdict(['person', 'fear']).title).toBe('Голос смешанный');
    expect(buildVerdict(['person', 'fear', 'shame']).title).toBe(
      'Голос смешанный',
    );
  });

  it('все четыре — говорит критик', () => {
    expect(buildVerdict([...PHRASE_MARK_IDS]).title).toBe('Говорит критик');
  });

  it('дубли и незнакомые id не завышают счёт', () => {
    const dup = buildVerdict(['person', 'person', 'person', 'person']);
    expect(dup.title).toBe('Почти забота');
    const junk = buildVerdict(['person', 'выдумка' as never]);
    expect(junk.title).toBe('Почти забота');
  });

  it('ни один вердикт не переходит на личность читателя', () => {
    const all = [
      buildVerdict([]),
      buildVerdict(['person']),
      buildVerdict(['person', 'fear']),
      buildVerdict([...PHRASE_MARK_IDS]),
    ];
    for (const v of all) {
      expect(v.title).not.toMatch(/ты|вы|тебя|вас/i);
      expect(v.text).not.toMatch(/(^|[^а-яё])(ты|вы|тебя|вас)([^а-яё]|$)/i);
    }
  });
});
