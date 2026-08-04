// @vitest-environment jsdom
// Карточка-лента «Мой путь»: journeyCardHeight — чистая формула высоты,
// drawJourneyCard — раскладка с рельсой и без единого шага (пустое
// состояние, правило «никаких заглушек» — пустой путь показывает поясняющую
// строку, а не нулевые узлы).
import { describe, it, expect, vi, afterEach } from 'vitest';
import { journeyCardHeight, drawJourneyCard } from './journeyCard';
import type { JourneyCardRow } from '../../journey/journeyMeta';

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

const ROW: JourneyCardRow = {
  emoji: '🌱',
  label: 'Дневник благодарности',
  day: '3 мая',
  hex: '#4fd18b',
};

describe('journeyCardHeight', () => {
  it('без строк — компактная (одна поясняющая строка вместо списка)', () => {
    expect(journeyCardHeight([])).toBeLessThan(journeyCardHeight([ROW, ROW]));
  });

  it('высота растёт с числом строк', () => {
    expect(journeyCardHeight([ROW, ROW, ROW])).toBeGreaterThan(
      journeyCardHeight([ROW]),
    );
  });
});

describe('drawJourneyCard', () => {
  it('со строками — рисует рельсу и узлы, не падает', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
      mockCtx(),
    );
    const canvas = document.createElement('canvas');
    expect(() =>
      drawJourneyCard(canvas, [ROW, { ...ROW, label: 'Трекер' }], 12),
    ).not.toThrow();
  });

  it('пустой путь — «пока нет ни одного шага», не падает', () => {
    const ctx = mockCtx();
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx);
    const canvas = document.createElement('canvas');
    expect(() => drawJourneyCard(canvas, [], 0)).not.toThrow();
    expect(ctx.fillText).toHaveBeenCalledWith(
      'Пока нет ни одного шага',
      expect.any(Number),
      expect.any(Number),
    );
  });
});
