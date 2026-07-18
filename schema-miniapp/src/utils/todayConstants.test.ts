// @vitest-environment jsdom
// Тест fillHistoryGaps — заполнение пропущенных дней в истории трекера
// пустыми рейтингами, чтобы TrackerHistoryOverlay рисовал сплошную шкалу
// дат, а не «дыры». Вынесено из App.tsx (этап 3 REMEDIATION_PLAN).
import { describe, it, expect } from 'vitest';
import { fillHistoryGaps, TODAY_DATE } from './todayConstants';
import { DayHistory } from '../types';

// Тот же способ форматирования даты, что и в реализации (UTC toISOString),
// чтобы фикстуры совпадали с тем, что генерирует cursor внутри функции.
function offsetDate(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().split('T')[0];
}

const entry = (
  daysAgo: number,
  ratings: Record<string, number> = {},
): DayHistory => ({
  date: offsetDate(daysAgo),
  ratings,
});

describe('fillHistoryGaps', () => {
  it('пустая история — возвращается пустой массив как есть', () => {
    const result = fillHistoryGaps([]);
    expect(result).toEqual([]);
  });

  it('только запись за сегодня (нет других дней) — возвращается без изменений', () => {
    const h = [entry(0, { safety: 5 })];
    const result = fillHistoryGaps(h);
    expect(result).toBe(h);
  });

  it('без пропусков — один нетодейшный день возвращается как есть (без лишних заполнений)', () => {
    const h = [entry(1, { safety: 3 })];
    const result = fillHistoryGaps(h);
    expect(result).toEqual([entry(1, { safety: 3 })]);
  });

  it('заполняет дыры между сегодня и самой ранней записью пустыми рейтингами', () => {
    const h = [entry(0, { safety: 5 }), entry(3, { safety: 2 })];
    const result = fillHistoryGaps(h);

    expect(result.map((d) => d.date)).toEqual([
      offsetDate(0),
      offsetDate(1),
      offsetDate(2),
      offsetDate(3),
    ]);
    expect(result[0].ratings).toEqual({ safety: 5 });
    expect(result[1].ratings).toEqual({}); // дыра — вчера
    expect(result[2].ratings).toEqual({}); // дыра — позавчера
    expect(result[3].ratings).toEqual({ safety: 2 }); // самая ранняя, реальные данные
  });

  it('не заполняет дни старше самой ранней записи', () => {
    const h = [entry(0, {}), entry(2, {})];
    const result = fillHistoryGaps(h);
    const dates = result.map((d) => d.date);
    expect(dates).not.toContain(offsetDate(3));
    expect(dates[dates.length - 1]).toBe(offsetDate(2));
  });

  it('без записи за сегодня — заполнение начинается со вчера, todayEntry в результате отсутствует', () => {
    const h = [entry(1, { safety: 4 }), entry(2, {})];
    const result = fillHistoryGaps(h);
    expect(result.map((d) => d.date)).toEqual([offsetDate(1), offsetDate(2)]);
    expect(result.every((d) => d.date !== TODAY_DATE)).toBe(true);
  });

  it('существующие дни внутри диапазона не перезаписываются пустыми рейтингами', () => {
    const h = [entry(0, {}), entry(1, { safety: 7 }), entry(2, {})];
    const result = fillHistoryGaps(h);
    const mid = result.find((d) => d.date === offsetDate(1));
    expect(mid?.ratings).toEqual({ safety: 7 });
  });
});
