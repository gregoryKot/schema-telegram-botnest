// @vitest-environment jsdom
// Сводная карточка достижений: сетка эмодзи + полоска прогресса. Проверяем,
// что пустой список (0 из 0) не делит на ноль и не падает — самое частое
// место таких карточек ломаться (см. правило «никаких хардкод-заглушек»:
// пустой аккаунт обязан показать 0%, а не NaN%).
import { describe, it, expect, vi, afterEach } from 'vitest';
import { drawAchievementsCard } from './achievementsCard';

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

describe('drawAchievementsCard', () => {
  it('часть достижений получена — не падает, рисует и яркие, и приглушённые', () => {
    const ctx = mockCtx();
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx);
    const canvas = document.createElement('canvas');
    expect(() =>
      drawAchievementsCard(canvas, [
        { emoji: '🏆', earned: true },
        { emoji: '🔥', earned: false },
        { emoji: '🌱', earned: true },
      ]),
    ).not.toThrow();
    expect(ctx.fillText).toHaveBeenCalledWith(
      '2 из 3',
      expect.any(Number),
      expect.any(Number),
    );
  });

  it('пустой список — 0 из 0, без деления на ноль', () => {
    const ctx = mockCtx();
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx);
    const canvas = document.createElement('canvas');
    expect(() => drawAchievementsCard(canvas, [])).not.toThrow();
    expect(ctx.fillText).toHaveBeenCalledWith(
      '0%',
      expect.any(Number),
      expect.any(Number),
    );
  });

  it('больше 5 плиток переносится на вторую строку сетки, не падает', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
      mockCtx(),
    );
    const canvas = document.createElement('canvas');
    const items = Array.from({ length: 12 }, (_, i) => ({
      emoji: '🏅',
      earned: i % 2 === 0,
    }));
    expect(() => drawAchievementsCard(canvas, items)).not.toThrow();
  });
});
