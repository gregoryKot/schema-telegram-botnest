// @vitest-environment jsdom
// Карточка фразы Здорового Взрослого в editorial-стиле: длинная цитата
// обрезается до 8 строк (QUOTE_MAX_LINES); фон без свечений, цитата — serif
// обычным начертанием, внизу подпись канала вместо логотипа.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { drawPhraseCard } from './phraseCard';
import { canvasWithMockCtx } from './canvas.test-helpers';

afterEach(() => {
  vi.restoreAllMocks();
});

/** Шрифты, которыми реально вызывали fillText, — по порядку вызовов. */
function fontsOfFillText(ctx: ReturnType<typeof canvasWithMockCtx>['ctx']) {
  const fonts: string[] = [];
  let current = '';
  Object.defineProperty(ctx, 'font', {
    get: () => current,
    set: (v: string) => (current = v),
  });
  ctx.fillText.mockImplementation((s: string) => {
    fonts.push(`${current}|${s}`);
  });
  return fonts;
}

describe('drawPhraseCard', () => {
  it('короткая фраза — не падает', () => {
    const { canvas } = canvasWithMockCtx();
    expect(() =>
      drawPhraseCard(canvas, 'Ты имеешь право отдохнуть'),
    ).not.toThrow();
  });

  it('очень длинная фраза (обрезка до 8 строк) не роняет расчёт высоты', () => {
    const { canvas } = canvasWithMockCtx();
    expect(() => drawPhraseCard(canvas, 'слово '.repeat(120))).not.toThrow();
    expect(canvas.height).toBeGreaterThan(0);
  });

  it('подпись внизу — канал @MyHealthyAdult, без логотипа SchemeHappens', () => {
    const { canvas, ctx } = canvasWithMockCtx();
    drawPhraseCard(canvas, 'Я справлюсь');
    const drawn = ctx.fillText.mock.calls.map((a: unknown[]) => a[0]);
    expect(drawn).toContain('@MyHealthyAdult');
    expect(drawn).not.toContain('@SchemeHappens');
  });

  it('фон ровный: ни одного свечения (createRadialGradient) и градиентов', () => {
    const { canvas, ctx } = canvasWithMockCtx();
    drawPhraseCard(canvas, 'Я справлюсь');
    expect(ctx.createRadialGradient).not.toHaveBeenCalled();
    expect(ctx.createLinearGradient).not.toHaveBeenCalled();
  });

  it('цитата рисуется serif-шрифтом темы, обычным начертанием, 26px', () => {
    const { canvas, ctx } = canvasWithMockCtx();
    const fonts = fontsOfFillText(ctx);
    drawPhraseCard(canvas, 'Я справлюсь');
    const quote = fonts.find((f) => f.includes('«Я справлюсь»'));
    expect(quote).toBeDefined();
    expect(quote).toMatch(/^26px .*serif/);
    expect(quote).not.toMatch(/bold/);
    expect(quote).not.toMatch(/apple-system/);
  });
});
