// Сетка активности карточки месяца: последние 28 дней (включая сегодня),
// без сдвига часового пояса (даты строятся через UTC-компоненты).
import { describe, it, expect } from 'vitest';
import { buildMonthGrid } from './monthCard';

describe('buildMonthGrid', () => {
  it('28 ячеек, последняя — сегодняшний день', () => {
    const grid = buildMonthGrid(new Set(['2026-07-21']), '2026-07-21');
    expect(grid.cells).toHaveLength(28);
    expect(grid.cells[27]).toBe(true); // today отмечен
    expect(grid.activeDays).toBe(1);
  });

  it('пустой набор дат — все ячейки false, activeDays=0 (пустой аккаунт)', () => {
    const grid = buildMonthGrid(new Set(), '2026-07-21');
    expect(grid.cells.every((c) => c === false)).toBe(true);
    expect(grid.activeDays).toBe(0);
  });

  it('дата за пределами 28 дней не попадает в сетку', () => {
    const grid = buildMonthGrid(new Set(['2026-06-01']), '2026-07-21');
    expect(grid.activeDays).toBe(0);
  });

  it('дата ровно 27 дней назад (первая ячейка) учитывается', () => {
    const grid = buildMonthGrid(new Set(['2026-06-24']), '2026-07-21');
    expect(grid.cells[0]).toBe(true);
    expect(grid.activeDays).toBe(1);
  });

  it('несколько активных дней считаются верно', () => {
    const grid = buildMonthGrid(
      new Set(['2026-07-21', '2026-07-20', '2026-07-01']),
      '2026-07-21',
    );
    expect(grid.activeDays).toBe(3);
  });
});
