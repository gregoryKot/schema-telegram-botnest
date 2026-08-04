// Карточка недели трекера — чистые расчёты (среднее по потребности за
// неделю, диапазон дат, индекс недели, текст шаринга кратким/детальным).
import { describe, it, expect } from 'vitest';
import {
  calcWeekAvg,
  weekRange,
  weekIndex,
  buildWeeklyShareText,
} from './weeklyCard';
import type { Need, DayHistory } from '../../types';

const NEEDS: Need[] = [
  {
    id: 'attachment',
    emoji: '🤝',
    title: 'Привязанность',
    chartLabel: 'Привяз.',
  },
  { id: 'autonomy', emoji: '🧭', title: 'Автономия', chartLabel: 'Автоном.' },
];

const history: DayHistory[] = [
  { date: '2026-07-13', ratings: { attachment: 6, autonomy: 4 } },
  { date: '2026-07-14', ratings: { attachment: 8 } },
  { date: '2026-07-16', ratings: { autonomy: 8 } },
];

describe('calcWeekAvg', () => {
  it('среднее только по дням, где потребность отмечена', () => {
    expect(calcWeekAvg(history, 'attachment')).toBe(7); // (6+8)/2
  });

  it('потребность нигде не отмечена — null, не 0', () => {
    expect(calcWeekAvg(history, 'expression')).toBeNull();
  });

  it('пустая история — null', () => {
    expect(calcWeekAvg([], 'attachment')).toBeNull();
  });
});

describe('weekRange', () => {
  it('две и более дат — «первая — последняя» по возрастанию', () => {
    expect(weekRange(history)).toBe('13 июл — 16 июл');
  });

  it('одна дата — без диапазона', () => {
    expect(weekRange([{ date: '2026-07-13', ratings: {} }])).toBe('13 июл');
  });

  it('пустая история — пустая строка', () => {
    expect(weekRange([])).toBe('');
  });
});

describe('weekIndex', () => {
  it('среднее по средним каждой потребности', () => {
    // attachment avg=7, autonomy avg=6 → (7+6)/2 = 6.5
    expect(weekIndex(NEEDS, history)).toBe(6.5);
  });

  it('ни одна потребность не заполнена — null', () => {
    expect(weekIndex(NEEDS, [])).toBeNull();
  });
});

describe('buildWeeklyShareText', () => {
  it('краткий вариант: диапазон, индекс, серия только если streak > 0', () => {
    const withStreak = buildWeeklyShareText(NEEDS, history, 5, false, 'link');
    expect(withStreak).toContain('Серия: 5 дней');
    const noStreak = buildWeeklyShareText(NEEDS, history, 0, false, 'link');
    expect(noStreak).not.toContain('Серия');
  });

  it('детальный вариант перечисляет каждую потребность со своим средним', () => {
    const text = buildWeeklyShareText(NEEDS, history, 0, true, 'link');
    expect(text).toContain('Привяз.: 7.0');
    expect(text).toContain('Автоном.: 6.0');
  });

  it('детальный вариант: незаполненная потребность — «—», не 0.0', () => {
    const text = buildWeeklyShareText(
      [
        ...NEEDS,
        { id: 'play', emoji: '🎉', title: 'Игра', chartLabel: 'Игра' },
      ],
      history,
      0,
      true,
      'link',
    );
    expect(text).toContain('Игра: —');
  });
});
