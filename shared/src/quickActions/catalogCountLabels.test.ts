import { describe, it, expect } from 'vitest';
import { planCountLabel, practiceCountLabel } from './catalogCountLabels';

describe('счётчики каталогов «Что питает» и «Планы»', () => {
  it('«Что питает» считает действия, а не «практики»', () => {
    expect(practiceCountLabel(1)).toBe('1 действие');
    expect(practiceCountLabel(4)).toBe('4 действия');
    expect(practiceCountLabel(11)).toBe('11 действий');
    expect(practiceCountLabel(21)).toBe('21 действие');
  });

  it('пустой каталог назван словами, без нуля', () => {
    expect(practiceCountLabel(0)).toBe('Пока пусто');
    expect(planCountLabel(0)).toBe('История пуста');
  });

  it('планы склоняются', () => {
    expect(planCountLabel(1)).toBe('1 план');
    expect(planCountLabel(3)).toBe('3 плана');
    expect(planCountLabel(5)).toBe('5 планов');
  });
});
