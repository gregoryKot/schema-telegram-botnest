// @vitest-environment jsdom
// Легенда знаков: каждый знак из таблицы мотивов назван и объяснён; без обращения.
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { WhyLegend } from './WhyLegend';
import { LEGEND } from './legendText';

describe('WhyLegend', () => {
  it('пять знаков: полоска, лента, камешки, слои, круги — каждый с пояснением', () => {
    render(<WhyLegend />);
    expect(screen.getByRole('region', { name: 'Что означают картинки' })).toBeTruthy();
    for (const [sign, meaning] of LEGEND) {
      expect(screen.getByText(sign)).toBeTruthy();
      expect(screen.getByText(meaning)).toBeTruthy();
    }
    expect(LEGEND.map(([s]) => s)).toEqual(['Полоска', 'Лента', 'Камешки', 'Слои', 'Круги']);
  });
  it('у каждого слова — свой знак (язык знаков объяснён знаками), знаки не повторяются', () => {
    const { container } = render(<WhyLegend />);
    const rows = [...container.querySelectorAll('.cw-legend-row')];
    expect(rows.map((r) => r.querySelector('dt svg.pp-art--row') !== null)).toEqual(LEGEND.map(() => true));
    expect(new Set(LEGEND.map(([, , sign]) => sign)).size).toBe(LEGEND.length);
  });
  it('текст без обращения: ни «ты», ни «вы» — одна версия на обе формы', () => {
    const all = LEGEND.flat().join(' ');
    expect(all).not.toMatch(/\b(ты|тебе|тебя|твой|вы|вам|вас|ваш)\b/i);
  });
});
