import { describe, expect, it } from 'vitest';
import { formatPhaseRange } from './pathView';
import { buildPathTemplates } from '../../../../../../shared/src/therapy/path/templates';
import { parseOptionalWeeks, phaseWhen, templateSize } from './pathTerm';

describe('фаза без срока', () => {
  it('phaseWhen: срок, даты и подсказка — только то, что есть', () => {
    const dates = { start: '2026-01-05', end: '2026-02-02' };
    expect(phaseWhen(4, dates, '5–8 сессий')).toBe(`4 нед. · примерно ${formatPhaseRange(dates)} · 5–8 сессий`);
    expect(phaseWhen(null, null)).toBe('');
    expect(phaseWhen(null, null, '5–8 сессий')).toBe('5–8 сессий');
  });

  it('parseOptionalWeeks: пусто — без срока, мусор — закрыто', () => {
    expect(['', ' ', '6', '0', 'x'].map(parseOptionalWeeks)).toEqual([
      { valid: true, weeks: null }, { valid: true, weeks: null }, { valid: true, weeks: 6 },
      { valid: false, weeks: null }, { valid: false, weeks: null },
    ]);
  });
});

it('templateSize: у общего шаблона недель целиком нет', () => {
  const [general, , bpd] = buildPathTemplates((ty) => ty);
  expect(templateSize(general)).toBe('5 фаз');
  expect(templateSize(bpd)).toBe(`${bpd.phases.length} фаз · 104 нед.`);
});
