// Регрессионные тесты расчётов карточки недели (перенос из WeeklyCardSheet
// на общий кит — логика обязана совпасть со старой 1:1).
import { describe, it, expect } from 'vitest';
import {
  calcWeekAvg,
  weekIndex,
  weekRange,
  buildWeeklyShareText,
} from '../../../../shared/src/share/cards/weeklyCard';
import type { Need, DayHistory } from '../../types';

const needs = [
  { id: 'attachment', emoji: '🤝', chartLabel: 'Привязанность' },
  { id: 'autonomy', emoji: '🚀', chartLabel: 'Автономия' },
] as Need[];

const history: DayHistory[] = [
  { date: '2026-07-10', ratings: { attachment: 6, autonomy: 8 } },
  { date: '2026-07-12', ratings: { attachment: 8 } },
] as DayHistory[];

describe('calcWeekAvg', () => {
  it('среднее только по заполненным дням', () => {
    expect(calcWeekAvg(history, 'attachment')).toBe(7);
    expect(calcWeekAvg(history, 'autonomy')).toBe(8);
  });

  it('нет оценок → null', () => {
    expect(calcWeekAvg(history, 'limits')).toBeNull();
  });
});

describe('weekIndex', () => {
  it('среднее по средним потребностей', () => {
    expect(weekIndex(needs, history)).toBe(7.5);
  });

  it('пустая история → null', () => {
    expect(weekIndex(needs, [])).toBeNull();
  });
});

describe('weekRange', () => {
  it('диапазон из min и max дат', () => {
    expect(weekRange(history)).toMatch(/—/);
  });

  it('одна дата → без тире', () => {
    expect(weekRange([history[0]])).not.toMatch(/—/);
  });

  it('пусто → пустая строка', () => {
    expect(weekRange([])).toBe('');
  });
});

describe('buildWeeklyShareText', () => {
  it('короткий: индекс и серия', () => {
    const text = buildWeeklyShareText(needs, history, 7, false, 't.me/TestBot');
    expect(text).toContain('Индекс: 7.5/10');
    expect(text).toContain('Серия: 7 дней 🔥');
    expect(text).toContain('t.me/');
  });

  it('без стрика — без хвоста серии', () => {
    expect(
      buildWeeklyShareText(needs, history, 0, false, 't.me/TestBot'),
    ).not.toContain('Серия');
  });

  it('подробный: строка на каждую потребность', () => {
    const text = buildWeeklyShareText(needs, history, 0, true, 't.me/TestBot');
    expect(text).toContain('🤝 Привязанность: 7.0');
    expect(text).toContain('🚀 Автономия: 8.0');
  });
});
