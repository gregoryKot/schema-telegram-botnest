// Тест расчётов карточки дня (индекс дня + текст шаринга).
import { describe, it, expect } from 'vitest';
import {
  dayIndex,
  buildDayShareText,
} from '../../../../shared/src/share/cards/dayCard';
import type { Need } from '../../types';

const needs = [
  { id: 'attachment', emoji: '🤝', chartLabel: 'Привязанность' },
  { id: 'autonomy', emoji: '🚀', chartLabel: 'Автономия' },
] as Need[];

describe('dayIndex', () => {
  it('среднее по оценённым потребностям', () => {
    expect(dayIndex(needs, { attachment: 6, autonomy: 8 })).toBe(7);
  });

  it('игнорирует неоценённые', () => {
    expect(dayIndex(needs, { attachment: 5 })).toBe(5);
  });

  it('нет оценок → null', () => {
    expect(dayIndex(needs, {})).toBeNull();
  });
});

describe('buildDayShareText', () => {
  it('содержит индекс дня и ссылку', () => {
    const text = buildDayShareText(
      needs,
      { attachment: 6, autonomy: 8 },
      '17 июл',
      't.me/TestBot',
    );
    expect(text).toContain('Индекс дня: 7.0/10');
    expect(text).toContain('17 июл');
    expect(text).toContain('t.me/');
  });
});
