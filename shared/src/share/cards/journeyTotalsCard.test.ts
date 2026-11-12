// @vitest-environment jsdom
// Карточка итогов «Моего пути»: строки-хвост «и ещё N» и формула высоты
// карточки — чистые части, без canvas. drawJourneyTotalsCard — раскладка
// на подменённом 2d-контексте (jsdom его не реализует, см. cardKit.test.ts).
import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  totalsCardRows,
  journeyTotalsCardHeight,
  drawJourneyTotalsCard,
  JOURNEY_TOTALS_MAX_ROWS,
} from './journeyTotalsCard';
import type { JourneyStatRow } from '../../journey/journeyStats';
import { headerHeight, hueInkHex, paperHex } from '../cardKit';

function mockCtx() {
  return {
    scale: vi.fn(),
    translate: vi.fn(),
    rotate: vi.fn(),
    ellipse: vi.fn(),
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

const stat = (
  label: string,
  count: number,
  type = 'tracker_day',
): JourneyStatRow => ({ type, label, count });
const HEAD = headerHeight(1, 1);

describe('totalsCardRows', () => {
  it('ровно 8 строк — все показаны, хвоста нет', () => {
    const rows = Array.from({ length: 8 }, (_, i) => stat(`t${i}`, 8 - i));
    const { shown, restCount, max } = totalsCardRows(rows);
    expect(shown).toEqual(rows);
    expect(restCount).toBe(0);
    expect(max).toBe(8);
  });

  it('больше 8 — обрезка по JOURNEY_TOTALS_MAX_ROWS, остальное в хвост', () => {
    const rows = Array.from({ length: 11 }, (_, i) => stat(`t${i}`, 11 - i));
    const { shown, restCount } = totalsCardRows(rows);
    expect(shown).toHaveLength(JOURNEY_TOTALS_MAX_ROWS);
    expect(restCount).toBe(3);
  });

  it('пустая сводка — пусто, max=0 (пустой аккаунт без мусора)', () => {
    expect(totalsCardRows([])).toEqual({ shown: [], restCount: 0, max: 0 });
  });
});

describe('journeyTotalsCardHeight', () => {
  it('пустая сводка — компактнее (одна поясняющая строка вместо списка)', () => {
    const empty = journeyTotalsCardHeight(0, false, HEAD);
    const withRows = journeyTotalsCardHeight(3, false, HEAD);
    expect(empty).toBeLessThan(withRows);
  });

  it('наличие хвоста «и ещё N» увеличивает высоту', () => {
    expect(journeyTotalsCardHeight(3, true, HEAD)).toBeGreaterThan(
      journeyTotalsCardHeight(3, false, HEAD),
    );
  });

  it('высота растёт монотонно с числом показанных строк', () => {
    expect(journeyTotalsCardHeight(5, false, HEAD)).toBeGreaterThan(
      journeyTotalsCardHeight(2, false, HEAD),
    );
  });
});

describe('drawJourneyTotalsCard', () => {
  it('со списком занятий и хвостом «и ещё N» — не падает', () => {
    const ctx = mockCtx();
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx);
    const canvas = document.createElement('canvas');
    const rows = Array.from({ length: 11 }, (_, i) => stat(`t${i}`, 11 - i));
    expect(() => drawJourneyTotalsCard(canvas, rows, 55)).not.toThrow();
    expect(ctx.fillText).toHaveBeenCalledWith(
      expect.stringContaining('и ещё'),
      expect.any(Number),
      expect.any(Number),
    );
  });

  it('пустая сводка — «пока ни одного шага», не падает', () => {
    const ctx = mockCtx();
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx);
    const canvas = document.createElement('canvas');
    expect(() => drawJourneyTotalsCard(canvas, [], 0)).not.toThrow();
    expect(ctx.fillText).toHaveBeenCalledWith(
      'Пока ни одного шага — самое начало',
      expect.any(Number),
      expect.any(Number),
    );
  });

  it('строка — знак занятия (journeyStatLook) рисуется на листе, незнакомое — без знака', () => {
    const ctx = mockCtx();
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx);
    const canvas = document.createElement('canvas');
    drawJourneyTotalsCard(canvas, [stat('Дыхание', 4, 'breathing')], 4);
    const withSign = ctx.save.mock.calls.length;
    const ctx2 = mockCtx();
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx2);
    drawJourneyTotalsCard(canvas, [stat('Что-то новое', 4, 'future')], 4);
    expect(withSign).toBeGreaterThan(ctx2.save.mock.calls.length);
  });

  it('строка — знак на бумажке своего занятия, полоса — чернилами оттенка занятия', () => {
    const ctx = mockCtx();
    const fills: string[] = [];
    ctx.fill.mockImplementation(() => fills.push(ctx.fillStyle));
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx);
    drawJourneyTotalsCard(document.createElement('canvas'), [stat('Дыхание', 4, 'breathing'), stat('Трекер', 2)], 6);
    expect(fills).toEqual(expect.arrayContaining([paperHex(195), hueInkHex(195), paperHex(70), hueInkHex(70)]));
  });

  it('свои title/subtitle (сводка за период) переопределяют заголовок по умолчанию', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
      mockCtx(),
    );
    const canvas = document.createElement('canvas');
    expect(() =>
      drawJourneyTotalsCard(canvas, [stat('Дневник', 3)], 3, {
        title: 'Мой месяц',
        subtitle: 'за последние 30 дней',
      }),
    ).not.toThrow();
  });
});
