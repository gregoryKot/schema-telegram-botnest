// @vitest-environment jsdom
// Сводная карточка достижений (b23b): значки как в профиле — знак на бумажке своего оттенка;
// неполученный — силуэт одним тоном на тихой бумаге; полоска «N из M», пустой список без деления
// на ноль.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { achievementRows, drawAchievementsCard } from './achievementsCard';
import { canvasWithMockCtx } from './canvas.test-helpers';
import { silhouetteHex } from '../cardKit';

afterEach(() => {
  vi.restoreAllMocks();
});

/** Цвета заливок по порядку вызовов fill (fillStyle на момент fill). */
function fills(ctx: ReturnType<typeof canvasWithMockCtx>['ctx']) {
  const seen: string[] = [];
  ctx.fill.mockImplementation(() => {
    seen.push(String(ctx.fillStyle));
  });
  return seen;
}

describe('drawAchievementsCard', () => {
  it('«N из M» и проценты', () => {
    const { canvas, ctx } = canvasWithMockCtx();
    drawAchievementsCard(canvas, [
      { id: 'first_day', earned: true },
      { id: 'streak_3', earned: false },
      { id: 'high_day', earned: true },
    ]);
    const texts = ctx.printed.map((p) => p.text);
    expect(texts).toContain('2 из 3');
    expect(texts).toContain('67%');
  });

  it('неполученный значок — знак силуэтом одним тоном', () => {
    const earned = canvasWithMockCtx();
    const a = fills(earned.ctx);
    drawAchievementsCard(earned.canvas, [{ id: 'first_day', earned: true }]);
    const missing = canvasWithMockCtx();
    const b = fills(missing.ctx);
    drawAchievementsCard(missing.canvas, [{ id: 'first_day', earned: false }]);
    const tone = silhouetteHex(135);
    expect(a).not.toContain(tone);
    expect(b.filter((c) => c === tone)).toHaveLength(3); // три камешка Pebbles
  });

  it('пустой список — 0 из 0, без деления на ноль', () => {
    const { canvas, ctx } = canvasWithMockCtx();
    expect(() => drawAchievementsCard(canvas, [])).not.toThrow();
    expect(ctx.printed.map((p) => p.text)).toContain('0%');
  });
});

describe('achievementRows', () => {
  it('по четыре в ряд, неполный последний ряд остаётся коротким', () => {
    const rows = achievementRows(Array.from({ length: 13 }, (_, i) => i));
    expect(rows.map((r) => r.length)).toEqual([4, 4, 4, 1]);
    expect(achievementRows([])).toEqual([]);
  });
});
