// @vitest-environment jsdom
// Карточка-результат шага «Моего пути»: заголовок + до 3 частей заполненного
// текста на панелях. Как и у карточки благодарности, кризисная детекция
// свободного текста живёт на вводе (правило №7 CLAUDE.md), здесь только
// раскладка — с частью без заголовка (title опущен) и с несколькими частями.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { drawJourneyResultCard } from './journeyResultCard';

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

describe('drawJourneyResultCard', () => {
  it('несколько частей с заголовками — не падает', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
      mockCtx(),
    );
    const canvas = document.createElement('canvas');
    expect(() =>
      drawJourneyResultCard(canvas, {
        emoji: '🌱',
        label: 'Дневник благодарности',
        day: '3 мая',
        hex: '#4fd18b',
        parts: [
          { title: 'Что было', text: 'Утреннему кофе' },
          { text: 'Без заголовка тоже работает' },
        ],
      }),
    ).not.toThrow();
  });

  it('больше 3 частей — показаны только первые (MAX_PARTS), не падает', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
      mockCtx(),
    );
    const canvas = document.createElement('canvas');
    expect(() =>
      drawJourneyResultCard(canvas, {
        emoji: '📓',
        label: 'Дневник схем',
        day: '3 мая',
        hex: '#8f86ff',
        parts: [
          { title: 'A', text: '1' },
          { title: 'B', text: '2' },
          { title: 'C', text: '3' },
          { title: 'D', text: '4' },
        ],
      }),
    ).not.toThrow();
  });

  it('без частей (пустой массив) — не падает', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
      mockCtx(),
    );
    const canvas = document.createElement('canvas');
    expect(() =>
      drawJourneyResultCard(canvas, {
        emoji: '📓',
        label: 'Дневник схем',
        day: '3 мая',
        hex: '#8f86ff',
        parts: [],
      }),
    ).not.toThrow();
  });
});
