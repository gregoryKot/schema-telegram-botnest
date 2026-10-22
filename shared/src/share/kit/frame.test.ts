// @vitest-environment jsdom
// Обратная совместимость рамки: опции editorial-карточки (glow: false, brand
// в футере) не должны менять остальные ~20 карточек — без опций рисуются
// свечения и фирменная метка @SchemeHappens, как и раньше.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { beginCard, footer } from './frame';
import { canvasWithMockCtx } from '../cards/canvas.test-helpers';

afterEach(() => vi.restoreAllMocks());

const texts = (ctx: ReturnType<typeof canvasWithMockCtx>['ctx']) =>
  ctx.fillText.mock.calls.map((a: unknown[]) => a[0]);

describe('beginCard', () => {
  it('без опций рисует диагональный градиент и два свечения', () => {
    const { canvas, ctx } = canvasWithMockCtx();
    beginCard(canvas, 300);
    expect(ctx.createLinearGradient).toHaveBeenCalledTimes(1);
    expect(ctx.createRadialGradient).toHaveBeenCalledTimes(2);
  });

  it('glow: false — только заливка цветом темы, ни одного градиента', () => {
    const { canvas, ctx } = canvasWithMockCtx();
    const c = beginCard(canvas, 300, { glow: false });
    expect(ctx.createLinearGradient).not.toHaveBeenCalled();
    expect(ctx.createRadialGradient).not.toHaveBeenCalled();
    expect(ctx.fillRect).toHaveBeenCalledWith(0, 0, c.W, 300);
  });
});

describe('footer', () => {
  it('без опций — логотип-градиент, @SchemeHappens и подпись справа', () => {
    const { canvas, ctx } = canvasWithMockCtx();
    const c = beginCard(canvas, 300);
    ctx.createLinearGradient.mockClear();
    footer(c, 'Поддержка себе');
    expect(texts(ctx)).toEqual(['@SchemeHappens', 'Поддержка себе']);
    expect(ctx.createLinearGradient).toHaveBeenCalledTimes(1);
  });

  it('с brand — своя строка без логотипа, пустая подпись не рисуется', () => {
    const { canvas, ctx } = canvasWithMockCtx();
    const c = beginCard(canvas, 300, { glow: false });
    footer(c, '', { brand: '@Channel' });
    expect(texts(ctx)).toEqual(['@Channel']);
    expect(ctx.createLinearGradient).not.toHaveBeenCalled();
  });
});
