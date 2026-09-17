// Чистая логика экрана истории: день недели по дате, номер дня, среднее по
// оценённым потребностям (пустые/0 не считаются оценкой — иначе среднее
// было бы искусственно занижено «невыставленными» нулями).
import { describe, it, expect } from 'vitest';
import { getDayAbbr, getDayNum, dayAvg } from './constants';
import type { DayHistory, Need } from '../../types';

describe('getDayAbbr', () => {
  it('возвращает короткое русское название дня недели', () => {
    // 2026-08-10 — понедельник
    expect(getDayAbbr('2026-08-10')).toBe('пн');
    // 2026-08-16 — воскресенье
    expect(getDayAbbr('2026-08-16')).toBe('вс');
  });
});

describe('getDayNum', () => {
  it('отбрасывает ведущий ноль дня', () => {
    expect(getDayNum('2026-08-03')).toBe('3');
    expect(getDayNum('2026-08-23')).toBe('23');
  });
});

describe('dayAvg', () => {
  const NEEDS: Need[] = [
    { id: 'attachment', emoji: '💙', title: 'A', chartLabel: 'A' },
    { id: 'autonomy', emoji: '🔑', title: 'B', chartLabel: 'B' },
  ];

  it('без единой оценки за день — null (пусто, а не 0)', () => {
    const day: DayHistory = { date: '2026-08-03', ratings: {} };
    expect(dayAvg(day, NEEDS)).toBeNull();
  });

  it('нулевые оценки не считаются выставленными — тоже null', () => {
    const day: DayHistory = {
      date: '2026-08-03',
      ratings: { attachment: 0, autonomy: 0 },
    };
    expect(dayAvg(day, NEEDS)).toBeNull();
  });

  it('среднее считается только по реально оценённым потребностям', () => {
    const day: DayHistory = {
      date: '2026-08-03',
      ratings: { attachment: 8, autonomy: 0 },
    };
    // autonomy=0 исключается — среднее равно самой оценке attachment
    expect(dayAvg(day, NEEDS)).toBe(8);
  });

  it('среднее по двум оценкам', () => {
    const day: DayHistory = {
      date: '2026-08-03',
      ratings: { attachment: 6, autonomy: 4 },
    };
    expect(dayAvg(day, NEEDS)).toBe(5);
  });
});
