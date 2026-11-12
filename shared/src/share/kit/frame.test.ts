// @vitest-environment jsdom
// Рамка карточки на бумаге: лист оттенка сущности на втором листе тоном глубже (сдвиг
// вправо-вниз, без градиентов), шапка Literata со знаком справа, подвал со знаком продукта.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { beginCard, footer } from './frame';
import { header, headerHeight, measureHeader } from './header';
import { CARD_PAD, SERIF } from './theme';
import { SHEET, layerHex, paperHex, hueFromColor } from './paperFrame';
import { INK } from './ink';
import { canvasWithMockCtx } from '../cards/canvas.test-helpers';

afterEach(() => vi.restoreAllMocks());

const texts = (ctx: ReturnType<typeof canvasWithMockCtx>['ctx']) =>
  ctx.printed.map((p) => p.text);

describe('beginCard', () => {
  it('страница, второй лист со сдвигом и лист бумаги оттенка — без единого градиента', () => {
    const { canvas, ctx } = canvasWithMockCtx();
    const fills: string[] = [];
    ctx.fill.mockImplementation(() => fills.push(ctx.fillStyle));
    const c = beginCard(canvas, 300, { hue: 195 });
    expect(c.hue).toBe(195);
    expect(ctx.fillRect).toHaveBeenCalledWith(0, 0, c.W, 300);
    expect(fills).toEqual([layerHex(195), paperHex(195)]);
    expect(ctx.roundRect.mock.calls[0].slice(0, 2)).toEqual([
      SHEET.x + SHEET.dx,
      SHEET.y + SHEET.dy,
    ]);
    expect(ctx.roundRect.mock.calls[1].slice(0, 2)).toEqual([SHEET.x, SHEET.y]);
    expect(ctx.createLinearGradient).not.toHaveBeenCalled();
    expect(ctx.createRadialGradient).not.toHaveBeenCalled();
  });

  it('без hue — бумага ближайшая к цвету сущности старого вызова', () => {
    const { canvas } = canvasWithMockCtx();
    expect(beginCard(canvas, 300, { accent: 'var(--c-rose)' }).hue).toBe(
      hueFromColor('var(--c-rose)'),
    );
  });
});

describe('header', () => {
  it('заголовок — Literata, эйбрау — чернилами оттенка, высота совпадает с формулой', () => {
    const { canvas, ctx } = canvasWithMockCtx();
    const c = beginCard(canvas, 400, { hue: 70 });
    const y = header(c, {
      eyebrow: 'Трекер',
      title: 'Мой день',
      subtitle: '12 ноя',
      sign: 'strokes',
    });
    const title = ctx.printed.find((p) => p.text === 'Мой день')!;
    expect(title.font).toContain(SERIF);
    expect(ctx.printed.find((p) => p.text === 'ТРЕКЕР')).toBeDefined();
    expect(y).toBe(headerHeight(1, 1));
    expect(
      measureHeader(canvas, { title: 'Мой день', subtitle: '12 ноя' }),
    ).toBe(y);
  });

  it('длинная подпись переносится целиком и обрезается многоточием, а не уходит за поле', () => {
    const { canvas, ctx } = canvasWithMockCtx();
    const c = beginCard(canvas, 400, { hue: 195 });
    const lead =
      'Вдох короче выдоха — так тело получает сигнал, что опасность миновала и можно отпустить напряжение плеч и живота';
    header(c, {
      title: 'Дыхание',
      subtitle: lead,
      subtitleLines: 2,
      sign: 'breath',
    });
    const sub = ctx.printed.filter((p) => p.font.startsWith('13.5px'));
    expect(sub).toHaveLength(2);
    expect(sub[1].text.endsWith('…')).toBe(true);
    for (const p of sub)
      expect(p.x + p.width).toBeLessThanOrEqual(c.W - CARD_PAD);
  });
});

describe('footer', () => {
  it('знак продукта (22 px), @SchemeHappens и подпись справа, чернилами подписи', () => {
    const { canvas, ctx } = canvasWithMockCtx();
    const c = beginCard(canvas, 300, { hue: 70 });
    ctx.roundRect.mockClear();
    footer(c, 'Поддержка себе');
    expect(texts(ctx)).toEqual(['@SchemeHappens', 'Поддержка себе']);
    expect(ctx.roundRect.mock.calls[0].slice(0, 4)).toEqual([
      CARD_PAD,
      expect.any(Number),
      22,
      22,
    ]);
    expect(ctx.printed.every((p) => p.align !== 'center')).toBe(true);
    expect(ctx.fillStyle).toBe(INK.sub);
  });

  it('с brand — своя строка без знака, пустая подпись не рисуется', () => {
    const { canvas, ctx } = canvasWithMockCtx();
    const c = beginCard(canvas, 300, { hue: 70 });
    ctx.arc.mockClear();
    footer(c, '', { brand: '@Channel' });
    expect(texts(ctx)).toEqual(['@Channel']);
    expect(ctx.arc).not.toHaveBeenCalled();
  });
});
