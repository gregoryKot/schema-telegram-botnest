// @vitest-environment jsdom
// Карточка-лента «Мой путь» (b23b): buildJourneyCardRows — вид шага из journeyItemLook,
// journeyCardHeight — чистая формула высоты, drawJourneyCard — строки со знаками на бумажках
// и пустое состояние (правило «никаких заглушек» — пустой путь показывает поясняющую строку).
import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  buildJourneyCardRows,
  journeyCardHeight,
  drawJourneyCard,
  type JourneyCardRow,
} from './journeyCard';
import { INK, headerHeight, sunkHex } from '../cardKit';
import { JOURNEY_LOOK } from '../../journey/journeyLook';

function mockCtx() {
  const ctx = {
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
  return ctx as unknown as typeof ctx & CanvasRenderingContext2D;
}

afterEach(() => {
  vi.restoreAllMocks();
});

const ROW: JourneyCardRow = {
  label: 'Благодарность',
  day: '3 мая',
  hue: 195,
  sign: 'pebbles',
};
const HEAD = headerHeight(1, 1);

describe('buildJourneyCardRows', () => {
  it('режет по максимуму; знак и бумага — вид шага (journeyItemLook), без эмодзи и hex', () => {
    const rows = buildJourneyCardRows(
      Array.from({ length: 12 }, (_, i) => ({
        type: 'plan_done',
        at: `2026-07-${String(i + 1).padStart(2, '0')}`,
      })),
      8,
    );
    expect(rows).toHaveLength(8);
    expect(rows[0]).toEqual({
      label: 'Шаг по плану',
      day: '1 июля',
      hue: JOURNEY_LOOK.plan_done.hue,
      sign: JOURNEY_LOOK.plan_done.sign,
    });
  });

  it('шаг на одну потребность — бумага и знак потребности', () => {
    const [row] = buildJourneyCardRows([
      { type: 'practice', at: '2026-07-01', needId: 'play' },
    ]);
    expect(row).toMatchObject({ hue: 310, sign: 'need_play' });
  });

  it('благодарность — вариант Pebbles filled (n), заметка дня — без варианта', () => {
    const [g, note] = buildJourneyCardRows([
      { type: 'gratitude', at: '2026-07-01' },
      { type: 'note', at: '2026-07-01' },
    ]);
    expect(g).toMatchObject({ sign: 'pebbles', n: 1 });
    expect(note.n).toBeUndefined();
  });

  it('дефолтный максимум — 8 строк; незнакомый тип — без знака', () => {
    const items = Array.from({ length: 20 }, () => ({
      type: 'future_type',
      at: '2026-07-01',
    }));
    const rows = buildJourneyCardRows(items);
    expect(rows).toHaveLength(8);
    expect(rows[0]).toMatchObject({ label: 'Запись', hue: null, sign: null });
  });
});

describe('journeyCardHeight', () => {
  it('без строк — компактная (одна поясняющая строка вместо списка)', () => {
    expect(journeyCardHeight([], HEAD)).toBeLessThan(
      journeyCardHeight([ROW, ROW], HEAD),
    );
  });

  it('высота растёт с числом строк и с ростом шапки', () => {
    expect(journeyCardHeight([ROW, ROW, ROW], HEAD)).toBeGreaterThan(
      journeyCardHeight([ROW], HEAD),
    );
    expect(journeyCardHeight([ROW], HEAD + 19)).toBe(
      journeyCardHeight([ROW], HEAD) + 19,
    );
  });
});

describe('drawJourneyCard', () => {
  it('со строками — рисует строки, не падает', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
      mockCtx(),
    );
    const canvas = document.createElement('canvas');
    expect(() =>
      drawJourneyCard(
        canvas,
        [ROW, { ...ROW, label: 'Трекер', hue: null, sign: null }],
        12,
      ),
    ).not.toThrow();
  });

  it('бумажка оттенка самого листа (режимы на небе) — тон глубже своей бумаги, не белая', () => {
    const ctx = mockCtx();
    const fills: string[] = [];
    ctx.fill.mockImplementation(() => fills.push(ctx.fillStyle));
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx);
    drawJourneyCard(
      document.createElement('canvas'),
      [{ ...ROW, hue: 240, sign: 'cluster' }],
      1,
    );
    expect(fills).toContain(sunkHex(240));
    expect(fills).not.toContain(INK.surface);
  });

  it('пустой путь — «пока нет ни одного шага», не падает', () => {
    const ctx = mockCtx();
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx);
    const canvas = document.createElement('canvas');
    expect(() => drawJourneyCard(canvas, [], 0)).not.toThrow();
    expect(ctx.fillText).toHaveBeenCalledWith(
      'Пока нет ни одного шага',
      expect.any(Number),
      expect.any(Number),
    );
  });
});
