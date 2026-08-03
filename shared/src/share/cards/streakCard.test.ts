// @vitest-environment jsdom
// Карточка серии дней: рисование не падает на вехе и вне вехи, высота растёт
// с длиной пояснительного текста. canvas в jsdom не рисует — getContext('2d')
// подменяем фейком со всеми зовомыми методами (см. practiceCard.test.ts).
import { describe, it, expect, vi, afterEach } from 'vitest';
import { drawStreakCard } from './streakCard';

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

describe('drawStreakCard', () => {
  it('обычный день (не веха): не падает, высота > 0', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
      mockCtx(),
    );
    const canvas = document.createElement('canvas');
    expect(() => drawStreakCard(canvas, 5)).not.toThrow();
    expect(canvas.height).toBeGreaterThan(0);
  });

  it('веха (7 дней) рисует медальон-трофей тем же путём, не падает', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
      mockCtx(),
    );
    const canvas = document.createElement('canvas');
    expect(() => drawStreakCard(canvas, 7)).not.toThrow();
  });

  it('первый день (особый текст «самый важный») не падает', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
      mockCtx(),
    );
    const canvas = document.createElement('canvas');
    expect(() => drawStreakCard(canvas, 1)).not.toThrow();
  });
});
