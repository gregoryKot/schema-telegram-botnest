// @vitest-environment jsdom
// Карточка одного шага «Моего пути» (b23b): journeyItemCardHeight — чистая формула (знак,
// строки названия и уточнения), drawJourneyItemCard — лист сущности шага со знаком; незнакомый
// тип — небо «Моего пути» без знака.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { journeyItemCardHeight, drawJourneyItemCard } from './journeyItemCard';
import { canvasWithMockCtx } from './canvas.test-helpers';

afterEach(() => {
  vi.restoreAllMocks();
});

const DATA = {
  label: 'Благодарность',
  sub: 'Привязанность',
  day: '3 мая',
  hue: 195,
  sign: 'pebbles',
};

describe('journeyItemCardHeight', () => {
  it('с уточнением и со знаком выше, чем без них', () => {
    expect(journeyItemCardHeight(true, 1, 1)).toBeGreaterThan(
      journeyItemCardHeight(true, 1, 0),
    );
    expect(journeyItemCardHeight(true, 1, 0)).toBeGreaterThan(
      journeyItemCardHeight(false, 1, 0),
    );
    expect(journeyItemCardHeight(true, 2, 0)).toBeGreaterThan(
      journeyItemCardHeight(true, 1, 0),
    );
  });
});

describe('drawJourneyItemCard', () => {
  it('рисует знак сущности, название и дату', () => {
    const { canvas, ctx } = canvasWithMockCtx();
    drawJourneyItemCard(canvas, DATA);
    const texts = ctx.printed.map((p) => p.text);
    expect(texts).toEqual(
      expect.arrayContaining([
        'МОЙ ПУТЬ',
        'Благодарность',
        'Привязанность',
        '3 мая',
      ]),
    );
    expect(ctx.ellipse).toHaveBeenCalled(); // камешки Pebbles
  });

  it('без уточнения — компактнее; незнакомый тип — без знака', () => {
    const a = canvasWithMockCtx();
    drawJourneyItemCard(a.canvas, DATA);
    const b = canvasWithMockCtx();
    drawJourneyItemCard(b.canvas, { ...DATA, sub: null });
    expect(b.canvas.height).toBeLessThan(a.canvas.height);
    const u = canvasWithMockCtx();
    drawJourneyItemCard(u.canvas, { ...DATA, hue: null, sign: null });
    expect(u.ctx.ellipse).not.toHaveBeenCalled();
  });
});
