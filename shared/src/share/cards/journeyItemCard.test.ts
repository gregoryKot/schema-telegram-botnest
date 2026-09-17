// @vitest-environment jsdom
// Карточка одного шага «Моего пути»: journeyItemCardHeight — чистая формула
// (зависит только от наличия уточнения sub), drawJourneyItemCard — раскладка
// с уточнением и без.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { journeyItemCardHeight, drawJourneyItemCard } from './journeyItemCard';

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

describe('journeyItemCardHeight', () => {
  it('с уточнением выше, чем без него', () => {
    expect(journeyItemCardHeight(true)).toBeGreaterThan(
      journeyItemCardHeight(false),
    );
  });
});

describe('drawJourneyItemCard', () => {
  it('с уточнением (sub) — не падает', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
      mockCtx(),
    );
    const canvas = document.createElement('canvas');
    expect(() =>
      drawJourneyItemCard(canvas, {
        emoji: '🌱',
        label: 'Дневник благодарности',
        sub: 'Привязанность',
        day: '3 мая',
        hex: '#4fd18b',
      }),
    ).not.toThrow();
  });

  it('без уточнения (sub=null) — компактнее, не падает', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
      mockCtx(),
    );
    const withSub = document.createElement('canvas');
    drawJourneyItemCard(withSub, {
      emoji: '🌱',
      label: 'Дневник благодарности',
      sub: 'Привязанность',
      day: '3 мая',
      hex: '#4fd18b',
    });
    const noSub = document.createElement('canvas');
    drawJourneyItemCard(noSub, {
      emoji: '🌱',
      label: 'Дневник благодарности',
      sub: null,
      day: '3 мая',
      hex: '#4fd18b',
    });
    expect(noSub.height).toBeLessThan(withSub.height);
  });
});
