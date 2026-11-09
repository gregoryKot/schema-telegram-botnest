// QA 2026-11 (B-М4): «За 7 дней», а линии по всей загруженной истории.
import { describe, it, expect } from 'vitest';
import { weekWindow, sparklineGeometry, SPARK_H } from './sparkline';
import type { DayHistory } from '../types';

// 30 дней от новых к старым, как приходит история трекера.
const HISTORY: DayHistory[] = Array.from({ length: 30 }, (_, i) => ({
  date: `2026-10-${String(30 - i).padStart(2, '0')}`,
  ratings: { autonomy: (i % 9) + 1 },
}));

describe('weekWindow', () => {
  it('сегодня выбрано — ровно последние 7 дней, а не вся история', () => {
    const w = weekWindow(HISTORY, 0, 7);
    expect(w).toHaveLength(7);
    expect(w[0].date).toBe('2026-10-30');
    expect(w[6].date).toBe('2026-10-24');
  });

  it('выбран день в прошлом — неделя, которая им кончается', () => {
    const w = weekWindow(HISTORY, 10, 7);
    expect(w.map((d) => d.date)).toEqual([
      '2026-10-20',
      '2026-10-19',
      '2026-10-18',
      '2026-10-17',
      '2026-10-16',
      '2026-10-15',
      '2026-10-14',
    ]);
  });

  it('раньше истории нет — окно короче, без выдуманных дней', () => {
    expect(weekWindow(HISTORY, 27, 7)).toHaveLength(3);
  });
});

describe('sparklineGeometry', () => {
  it('точек столько же, сколько дней в окне', () => {
    const g = sparklineGeometry(weekWindow(HISTORY, 0, 7), 'autonomy');
    expect(g.count).toBe(7);
    expect(g.line.match(/[ML] /g)).toHaveLength(7);
    expect(g.line.startsWith('M 0.0 ')).toBe(true);
  });

  it('маркер выбранного дня — справа, в процентах (не в растянутом svg)', () => {
    const win: DayHistory[] = [
      { date: '2026-10-02', ratings: { autonomy: 10 } },
      { date: '2026-10-01', ratings: { autonomy: 1 } },
    ];
    const g = sparklineGeometry(win, 'autonomy');
    expect(g.dot.left).toBe(100);
    expect(g.dot.top).toBeCloseTo((2 / SPARK_H) * 100);
  });

  it('одна точка — по центру', () => {
    const g = sparklineGeometry(
      [{ date: '2026-10-01', ratings: { autonomy: 1 } }],
      'autonomy',
    );
    expect(g.dot).toEqual({ left: 50, top: (25 / SPARK_H) * 100 });
  });

  // Ревью g2 r3: пропуск рисовался провалом до пола — выдуманный ноль.
  it('разрыв линии: день без оценки — ни точки, ни провала, после него M', () => {
    const win: DayHistory[] = [
      { date: '2026-10-05', ratings: { autonomy: 10 } },
      { date: '2026-10-04', ratings: { autonomy: 10 } },
      { date: '2026-10-03', ratings: {} },
      { date: '2026-10-02', ratings: { autonomy: 1 } },
      { date: '2026-10-01', ratings: { autonomy: 1 } },
    ];
    const g = sparklineGeometry(win, 'autonomy');
    expect(g.line).toBe('M 0.0 25.0 L 25.0 25.0 M 75.0 2.0 L 100.0 2.0');
    expect(g.count).toBe(4);
    expect(g.line).not.toContain(` ${SPARK_H - 1}.0`);
    expect(g.area.match(/Z/g)).toHaveLength(2);
  });

  it('одиночный день между пропусками — точкой (отрезок нулевой длины), без заливки', () => {
    const g = sparklineGeometry(
      [
        { date: '2026-10-03', ratings: {} },
        { date: '2026-10-02', ratings: { autonomy: 10 } },
        { date: '2026-10-01', ratings: {} },
      ],
      'autonomy',
    );
    expect(g.line).toBe('M 50.0 2.0 L 50.0 2.0');
    expect(g.area).toBe('');
  });

  it('выбранный день без оценки — без маркера', () => {
    const g = sparklineGeometry(
      [
        { date: '2026-10-02', ratings: {} },
        { date: '2026-10-01', ratings: { autonomy: 5 } },
      ],
      'autonomy',
    );
    expect(g.dot).toBeNull();
    expect(g.count).toBe(1);
  });

  it('пустое окно не падает', () => {
    expect(sparklineGeometry([], 'autonomy').area).toBe('');
  });
});
