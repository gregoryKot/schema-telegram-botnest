// @vitest-environment jsdom
// Карточка фразы Здорового Взрослого: длинная цитата обрезается до 7 строк
// (QUOTE_MAX_LINES) — проверяем, что и короткая, и предельно длинная фраза
// рисуются без исключений.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { drawPhraseCard } from './phraseCard';

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

describe('drawPhraseCard', () => {
  it('короткая фраза — не падает', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
      mockCtx(),
    );
    const canvas = document.createElement('canvas');
    expect(() =>
      drawPhraseCard(canvas, 'Ты имеешь право отдохнуть'),
    ).not.toThrow();
  });

  it('очень длинная фраза (обрезка до 7 строк) не роняет расчёт высоты', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
      mockCtx(),
    );
    const canvas = document.createElement('canvas');
    const long = 'слово '.repeat(120);
    expect(() => drawPhraseCard(canvas, long)).not.toThrow();
    expect(canvas.height).toBeGreaterThan(0);
  });
});
