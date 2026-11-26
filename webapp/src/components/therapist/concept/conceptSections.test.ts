import { describe, it, expect } from 'vitest';
import { appendTag, filledCount, filledSections, hasTag, CONCEPT_SECTIONS } from './conceptSections';

describe('filledCount', () => {
  it('пусто и пробелы не считаются', () => {
    expect(filledCount({})).toBe(0);
    expect(filledCount({ goals: '  \n', triggers: null })).toBe(0);
  });
  it('считает по реальным полям', () => {
    const v = { goals: 'a', triggers: 'b', currentProblems: ' c ' };
    expect(filledCount(v)).toBe(3);
    const f = filledSections(v);
    expect(f).toHaveLength(CONCEPT_SECTIONS.length);
    expect(f[CONCEPT_SECTIONS.findIndex((s) => s.key === 'triggers')]).toBe(true);
  });
});

describe('appendTag / hasTag', () => {
  it('в пустое поле — просто тег', () => {
    expect(appendTag('', 'Критика')).toBe('Критика');
  });
  it('к строке — через запятую; после точки — с новой строки', () => {
    expect(appendTag('Контроль', 'Критика')).toBe('Контроль, Критика');
    expect(appendTag('Ссоры дома.', 'Критика')).toBe('Ссоры дома.\nКритика');
  });
  it('повтор не добавляется, регистр не важен', () => {
    expect(hasTag('контроль, критика', 'Критика')).toBe(true);
    expect(appendTag('контроль, критика', 'Критика')).toBe('контроль, критика');
  });
  it('подстрока длинной фразы — не тег', () => {
    expect(hasTag('Много критики со стороны отца', 'Критика')).toBe(false);
  });
});
