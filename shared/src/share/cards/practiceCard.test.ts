// @vitest-environment jsdom
// Тест рисования карточки практики. jsdom не реализует canvas 2d-контекст
// (см. комментарий в ../cardKit.test.ts) — подменяем getContext('2d') лёгким
// фейком со всеми методами, которые реально зовёт cardKit/practiceCard, и
// проверяем, что рисование не падает и высота канваса посчиталась (>0).
import { describe, it, expect, vi, afterEach } from 'vitest';
import { drawPracticeCard, type PracticeCardData } from './practiceCard';

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
    createLinearGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
    measureText: vi.fn((s: string) => ({ width: s.length * 7 })),
    fillStyle: '',
    strokeStyle: '',
    font: '',
    lineWidth: 1,
    textAlign: 'left' as CanvasTextAlign,
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

const PRACTICE: PracticeCardData = {
  emoji: '🌬',
  title: 'Дыхание 4-4-6',
  subtitle: 'Вдох короче выдоха — так тело получает сигнал, что опасности нет',
  steps: [
    { emoji: '🌬️', title: 'Вдохни на 4 счёта' },
    { emoji: '⏸️', title: 'Задержи дыхание на 4 счёта' },
    { emoji: '💨', title: 'Выдохни на 6 счётов' },
  ],
};

describe('drawPracticeCard', () => {
  it('со счётчиком: не падает, высота канваса > 0', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
      mockCtx() as unknown as CanvasRenderingContext2D,
    );
    const canvas = document.createElement('canvas');
    expect(() =>
      drawPracticeCard(canvas, PRACTICE, 'прошли 7 раз'),
    ).not.toThrow();
    expect(canvas.height).toBeGreaterThan(0);
    expect(canvas.width).toBeGreaterThan(0);
  });

  it('без счётчика (null): не падает, высота канваса > 0', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
      mockCtx() as unknown as CanvasRenderingContext2D,
    );
    const canvas = document.createElement('canvas');
    expect(() => drawPracticeCard(canvas, PRACTICE, null)).not.toThrow();
    expect(canvas.height).toBeGreaterThan(0);
  });

  it('счётчик увеличивает высоту карточки', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
      mockCtx() as unknown as CanvasRenderingContext2D,
    );
    const withCount = document.createElement('canvas');
    drawPracticeCard(withCount, PRACTICE, 'прошли 7 раз');
    const withoutCount = document.createElement('canvas');
    drawPracticeCard(withoutCount, PRACTICE, null);
    expect(withCount.height).toBeGreaterThan(withoutCount.height);
  });
});
