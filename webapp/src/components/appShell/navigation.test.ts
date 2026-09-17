// Юнит-тесты чистых утилит навигации/истории AppShell (правило CLAUDE.md:
// «новая логика = тест»). fillHistoryGaps раньше тестировалась только
// косвенно через AppShell.overlays.test.tsx — здесь дополнены граничные
// случаи (пустая история, отсутствие «сегодня», дырка длиной больше суток).
import { describe, it, expect } from 'vitest';
import { sectionFromPath, fillHistoryGaps } from './navigation';
import { TODAY_DATE } from './useBootstrapLoad';

function addDays(dateStr: string, delta: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d + delta);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

describe('sectionFromPath', () => {
  it('распознаёт известные разделы, включая вложенный путь', () => {
    expect(sectionFromPath('/today')).toBe('today');
    expect(sectionFromPath('/diary')).toBe('diary');
    expect(sectionFromPath('/schemas/abandonment')).toBe('schemas');
    expect(sectionFromPath('/practice')).toBe('practice');
    expect(sectionFromPath('/profile')).toBe('profile');
  });

  it('легаси-пути /help и /exercises редиректят на «практика»', () => {
    expect(sectionFromPath('/help')).toBe('practice');
    expect(sectionFromPath('/exercises')).toBe('practice');
  });

  it('неизвестный и пустой путь падают на «сегодня»', () => {
    expect(sectionFromPath('/cabinet')).toBe('today');
    expect(sectionFromPath('/')).toBe('today');
    expect(sectionFromPath('')).toBe('today');
  });
});

describe('fillHistoryGaps', () => {
  it('пустая история возвращается как есть', () => {
    expect(fillHistoryGaps([])).toEqual([]);
  });

  it('только «сегодня» без других дней ничего не меняет (нет с чем сравнивать дырки)', () => {
    const only = [{ date: TODAY_DATE, ratings: { safety: 5 } }];
    expect(fillHistoryGaps(only)).toEqual(only);
  });

  it('дырка между сегодня и старой оценкой заполняется пустыми днями, а не пропадает', () => {
    const twoAgo = addDays(TODAY_DATE, -2);
    const result = fillHistoryGaps([
      { date: TODAY_DATE, ratings: { safety: 5 } },
      { date: twoAgo, ratings: { safety: 2 } },
    ]);
    const dates = result.map(d => d.date);
    expect(dates).toContain(TODAY_DATE);
    expect(dates).toContain(addDays(TODAY_DATE, -1));
    expect(dates).toContain(twoAgo);
    const gapDay = result.find(d => d.date === addDays(TODAY_DATE, -1));
    expect(gapDay?.ratings).toEqual({});
  });

  it('без записи «сегодня» в исходных данных синтетическая запись не добавляется', () => {
    const yesterday = addDays(TODAY_DATE, -1);
    const result = fillHistoryGaps([{ date: yesterday, ratings: { safety: 3 } }]);
    expect(result.some(d => d.date === TODAY_DATE)).toBe(false);
    expect(result[0].date).toBe(yesterday);
  });
});
