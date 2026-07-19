// Тесты сетки карточки месяца (последние 28 дней, UTC-математика дат).
import { describe, it, expect } from 'vitest';
import { buildMonthGrid } from '../../../../shared/src/share/cards/monthCard';

describe('buildMonthGrid', () => {
  it('28 ячеек, последняя — сегодня', () => {
    const grid = buildMonthGrid(new Set(['2026-07-19']), '2026-07-19');
    expect(grid.cells).toHaveLength(28);
    expect(grid.cells[27]).toBe(true);
    expect(grid.activeDays).toBe(1);
  });

  it('первая ячейка — 27 дней назад; более старые не считаются', () => {
    const grid = buildMonthGrid(
      new Set(['2026-06-22', '2026-06-21']),
      '2026-07-19',
    );
    expect(grid.cells[0]).toBe(true); // 22 июня = сегодня-27
    expect(grid.activeDays).toBe(1); // 21 июня — за пределами окна
  });

  it('переход через месяц и границу года', () => {
    const grid = buildMonthGrid(new Set(['2025-12-31']), '2026-01-05');
    // 31 декабря = сегодня-5 → индекс 27-5 = 22
    expect(grid.cells[22]).toBe(true);
    expect(grid.activeDays).toBe(1);
  });

  it('пустой набор — нулевая активность', () => {
    const grid = buildMonthGrid(new Set(), '2026-07-19');
    expect(grid.activeDays).toBe(0);
    expect(grid.cells.every((c) => !c)).toBe(true);
  });
});
