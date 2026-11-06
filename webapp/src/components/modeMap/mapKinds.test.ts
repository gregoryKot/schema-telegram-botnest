// Реестр типов графических карт (#963): порядок выбора, подписи и заголовок
// новой карты. Заголовок «Концептуализация · день» — в часовом поясе терапевта.
import { describe, it, expect } from 'vitest';
import { conceptMapTitle, distinctTitle, KIND_META, MAP_KINDS, newMapTitle } from './mapKinds';

const meta = (kind: (typeof MAP_KINDS)[number], title = 'x') => ({ kind, title });

describe('MAP_KINDS / KIND_META', () => {
  it('пять типов в порядке выбора: Концептуализация, Карта режимов, Карта ситуации, Карта пары, Свободный холст', () => {
    expect(MAP_KINDS.map(k => KIND_META[k].label)).toEqual([
      'Концептуализация', 'Карта режимов', 'Карта ситуации', 'Карта пары', 'Свободный холст',
    ]);
  });
});

describe('conceptMapTitle', () => {
  it('«Концептуализация · день месяц.» — день создания, месяц сокращённо', () => {
    expect(conceptMapTitle(new Date('2026-11-06T12:00:00Z'))).toBe('Концептуализация · 6 нояб.');
    expect(conceptMapTitle(new Date('2026-03-02T12:00:00Z'))).toBe('Концептуализация · 2 мар.');
  });
});

describe('distinctTitle — снимки одного дня различимы (QA 2026-10-26)', () => {
  const base = 'Концептуализация · 27 окт.';
  it('первой карте дня — имя без номера', () => {
    expect(distinctTitle(base, ['Карта режимов'])).toBe(base);
  });
  it('повтор — следующий свободный номер', () => {
    expect(distinctTitle(base, [base])).toBe(`${base} (2)`);
    expect(distinctTitle(base, [base, `${base} (2)`, `${base} (3)`])).toBe(`${base} (4)`);
  });
});

describe('newMapTitle', () => {
  const at = new Date('2026-11-06T12:00:00Z');
  it('карта режимов — «Карта режимов» (старые «Карты личности» в базе не трогаем)', () => {
    expect(newMapTitle('personality', [meta('personality', 'Карта личности')])).toBe('Карта режимов');
  });
  it('ситуации, пары и холсты нумеруются внутри своего типа', () => {
    const maps = [meta('problem'), meta('problem'), meta('couple'), meta('free')];
    expect(newMapTitle('problem', maps)).toBe('Ситуация 3');
    expect(newMapTitle('couple', maps)).toBe('Пара 2');
    expect(newMapTitle('free', maps)).toBe('Холст 2');
    expect(newMapTitle('free', [])).toBe('Холст 1');
  });
  it('концептуализация — по дню, вторая за день с номером', () => {
    expect(newMapTitle('concept', [], at)).toBe('Концептуализация · 6 нояб.');
    expect(newMapTitle('concept', [meta('concept', 'Концептуализация · 6 нояб.')], at)).toBe('Концептуализация · 6 нояб. (2)');
  });
});
