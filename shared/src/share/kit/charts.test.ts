// @vitest-environment jsdom
// Графика карточек на бумаге (charts.ts, needBars.ts): плитки-показатели, полоска доли и
// столбики дня — граничные значения не роняют раскладку, пустое не рисуется выдуманным.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { drawStatTiles, progressBar, STAT_TILE_H } from './charts';
import { drawDayBars, drawNeedRow, dayBarsHeight } from './needBars';
import { beginCard } from './frame';
import { needDataInk, needTextInk } from './ink';
import { canvasWithMockCtx } from '../cards/canvas.test-helpers';

afterEach(() => vi.restoreAllMocks());

function card() {
  const { canvas, ctx } = canvasWithMockCtx();
  const c = beginCard(canvas, 400, { hue: 70 });
  ctx.roundRect.mockClear();
  ctx.fill.mockClear();
  return { c, ctx };
}

describe('drawStatTiles', () => {
  it('возвращает Y ниже плиток и рисует хвост только когда он есть', () => {
    const { c, ctx } = card();
    expect(
      drawStatTiles(
        c,
        [{ label: 'Записей', value: '7', hint: 'записей' }],
        100,
      ),
    ).toBe(100 + STAT_TILE_H);
    expect(ctx.printed.map((p) => p.text)).toEqual(['ЗАПИСЕЙ', '7', 'записей']);
    ctx.printed.length = 0;
    drawStatTiles(c, [{ label: 'Серия', value: '12' }], 0);
    expect(ctx.printed.map((p) => p.text)).toEqual(['СЕРИЯ', '12']);
  });

  it('несколько плиток делят ширину поровну; пустой список не падает', () => {
    const { c, ctx } = card();
    drawStatTiles(
      c,
      [
        { label: 'a', value: '1' },
        { label: 'b', value: '2' },
      ],
      0,
    );
    const [a, b] = ctx.roundRect.mock.calls;
    expect(a[2]).toBe(b[2]);
    expect(() => drawStatTiles(c, [], 0)).not.toThrow();
  });
});

describe('progressBar', () => {
  it('pct=0 — только паз; pct за 0..1 обрезается до полной ширины', () => {
    const { c, ctx } = card();
    progressBar(c, 0, 0, 100, 0, '#000000');
    expect(ctx.fill).toHaveBeenCalledTimes(1);
    progressBar(c, 0, 0, 100, 5, '#000000');
    expect(ctx.roundRect.mock.calls.at(-1)?.[2]).toBe(100);
  });

  it('заливка — сплошной цвет данных, без градиента', () => {
    const { c, ctx } = card();
    progressBar(c, 0, 0, 100, 0.5, 'var(--c-moss)');
    expect(ctx.fillStyle).toBe('#6b8156');
    expect(ctx.createLinearGradient).not.toHaveBeenCalled();
  });
});

describe('drawDayBars / drawNeedRow', () => {
  it('оценённый столбик — цвет данных потребности, пропущенный — без него; высота блока по формуле', () => {
    const { c, ctx } = card();
    const fills: string[] = [];
    ctx.fill.mockImplementation(() => fills.push(ctx.fillStyle));
    const y = drawDayBars(
      c,
      [
        { id: 'attachment', value: 8 },
        { id: 'play', value: null },
      ],
      34,
      100,
      200,
      100,
    );
    expect(y).toBe(100 + dayBarsHeight(100));
    expect(fills).toContain(needDataInk('attachment'));
    expect(fills).not.toContain(needDataInk('play'));
  });

  it('строка: число читаемым тоном потребности, без оценки — «—» подписью', () => {
    const { c, ctx } = card();
    drawNeedRow(
      c,
      { id: 'limits', label: 'Границы', value: 6, valueText: '6' },
      0,
    );
    expect(ctx.printed.map((p) => p.text)).toEqual(['Границы', '6']);
    expect(ctx.fillStyle).toBe(needTextInk('limits'));
  });
});
