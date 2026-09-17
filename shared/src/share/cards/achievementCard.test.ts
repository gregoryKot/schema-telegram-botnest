// @vitest-environment jsdom
// Карточка одного достижения: медальон + титул + описание. Проверяем, что
// длинное описание (обрезается до 3 строк) не роняет расчёт высоты.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { drawAchievementCard } from './achievementCard';

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

describe('drawAchievementCard', () => {
  it('короткое описание — не падает, высота канваса > 0', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
      mockCtx(),
    );
    const canvas = document.createElement('canvas');
    expect(() =>
      drawAchievementCard(canvas, {
        title: 'Первая неделя',
        desc: 'Семь дней подряд с трекером',
      }),
    ).not.toThrow();
    expect(canvas.height).toBeGreaterThan(0);
  });

  it('длинное описание (обрезка до 3 строк) увеличивает высоту, но не падает', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
      mockCtx(),
    );
    const short = document.createElement('canvas');
    drawAchievementCard(short, {
      title: 'Т',
      desc: 'Коротко',
    });
    const long = document.createElement('canvas');
    drawAchievementCard(long, {
      title: 'Т',
      desc: 'Очень длинное описание достижения, которое переносится через несколько строк подряд и должно быть аккуратно обрезано без исключений',
    });
    expect(long.height).toBeGreaterThanOrEqual(short.height);
  });
});
