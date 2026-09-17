// @vitest-environment jsdom
// Сетка активности карточки месяца: последние 28 дней (включая сегодня),
// без сдвига часового пояса (даты строятся через UTC-компоненты).
// drawMonthCard — раскладка сетки на подменённом 2d-контексте (jsdom не
// реализует canvas, см. cardKit.test.ts).
import { describe, it, expect, vi, afterEach } from 'vitest';
import { buildMonthGrid, drawMonthCard } from './monthCard';

function mockCtx() {
  return {
    scale: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(),
    fill: vi.fn(),
    fillRect: vi.fn(),
    fillText: vi.fn(),
    roundRect: vi.fn(),
    arc: vi.fn(),
    clip: vi.fn(),
    setTransform: vi.fn(),
    shadowColor: '',
    shadowBlur: 0,
    createLinearGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
    createRadialGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
    measureText: vi.fn((s: string) => ({ width: s.length * 7 })),
    fillStyle: '',
    strokeStyle: '',
    font: '',
    lineWidth: 1,
    globalAlpha: 1,
    textAlign: 'left' as CanvasTextAlign,
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

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

describe('drawMonthCard', () => {
  it('с активными и пустыми днями — рисует сетку и плитки, не падает', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
      mockCtx(),
    );
    const canvas = document.createElement('canvas');
    const grid = buildMonthGrid(
      new Set(['2026-07-21', '2026-07-20']),
      '2026-07-21',
    );
    expect(() =>
      drawMonthCard(canvas, grid, 40, '23 июн — 21 июл'),
    ).not.toThrow();
  });

  it('пустой аккаунт (0 дней) — сетка вся выключена, не падает', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
      mockCtx(),
    );
    const canvas = document.createElement('canvas');
    const grid = buildMonthGrid(new Set(), '2026-07-21');
    expect(() =>
      drawMonthCard(canvas, grid, 0, '23 июн — 21 июл'),
    ).not.toThrow();
  });
});
