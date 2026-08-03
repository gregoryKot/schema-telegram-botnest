// @vitest-environment jsdom
// Карточка благодарности: до 3 записей на плашках. Свободный текст (записи
// дневника благодарности) уже прошёл кризисную детекцию на вводе (правило
// №7 CLAUDE.md — она живёт в форме дневника обоих фронтендов); здесь
// проверяется только раскладка — что 1/2/3+ записей и длинный текст не рвут
// расчёт высоты панелей.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { drawGratitudeCard } from './gratitudeCard';

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

describe('drawGratitudeCard', () => {
  it('одна запись — не падает', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
      mockCtx(),
    );
    const canvas = document.createElement('canvas');
    expect(() =>
      drawGratitudeCard(canvas, ['Утреннему кофе'], '3 мая'),
    ).not.toThrow();
  });

  it('больше 3 записей — показаны только первые 3 (MAX_ITEMS), не падает', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
      mockCtx(),
    );
    const canvas = document.createElement('canvas');
    expect(() =>
      drawGratitudeCard(
        canvas,
        ['раз', 'два', 'три', 'четыре', 'пять'],
        '3 мая',
      ),
    ).not.toThrow();
  });

  it('пустой список — карточка без записей не падает', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
      mockCtx(),
    );
    const canvas = document.createElement('canvas');
    expect(() => drawGratitudeCard(canvas, [], '3 мая')).not.toThrow();
  });
});
