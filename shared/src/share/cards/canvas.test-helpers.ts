// Подменённый 2d-контекст для тестов share-карточек: jsdom канвас не
// реализует, поэтому каждый card-тест до сих пор носил свою копию этого мока
// (15+ копий, их и считает jscpd). Новые тесты берут хелпер отсюда, старые
// переезжают по мере правок.
import { vi } from 'vitest';

export function mockCardCtx() {
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

/** Канвас с подменённым контекстом + сам контекст для проверок fillText. */
export function canvasWithMockCtx() {
  const canvas = document.createElement('canvas');
  const ctx = mockCardCtx();
  vi.spyOn(canvas, 'getContext').mockReturnValue(ctx);
  return { canvas, ctx };
}

/** Всё, что карточка напечатала — одной строкой (для toContain). */
export function printedText(ctx: ReturnType<typeof mockCardCtx>): string {
  return ctx.fillText.mock.calls.map((c) => String(c[0])).join(' ');
}
