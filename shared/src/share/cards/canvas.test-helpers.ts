// Подменённый 2d-контекст для тестов share-карточек: jsdom канвас не реализует.
// measureText зависит от кегля текущего ctx.font (≈0.56 em на знак) — так тест «текст
// в полях» ловит строку, которую карточка не перенесла под свой шрифт. Каждый fillText
// записывается вместе со шрифтом и выравниванием на момент вызова (`printed`).
import { vi } from 'vitest';

export interface Printed {
  text: string;
  x: number;
  y: number;
  font: string;
  align: CanvasTextAlign;
  width: number;
}

const fontSize = (font: string) => Number(/([\d.]+)px/.exec(font)?.[1] ?? 10);

export function mockCardCtx() {
  const printed: Printed[] = [];
  const ctx = {
    printed,
    scale: vi.fn(),
    translate: vi.fn(),
    rotate: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    closePath: vi.fn(),
    stroke: vi.fn(),
    fill: vi.fn(),
    fillRect: vi.fn(),
    fillText: vi.fn(function (
      this: unknown,
      text: string,
      x: number,
      y: number,
    ) {
      const s = String(text);
      printed.push({
        text: s,
        x,
        y,
        font: ctx.font,
        align: ctx.textAlign,
        width: ctx.measureText(s).width,
      });
    }),
    roundRect: vi.fn(),
    arc: vi.fn(),
    ellipse: vi.fn(),
    clip: vi.fn(),
    setTransform: vi.fn(),
    setLineDash: vi.fn(),
    drawImage: vi.fn(),
    createLinearGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
    createRadialGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
    measureText: vi.fn((s: string) => ({
      width: String(s).length * fontSize(ctx.font) * 0.56,
    })),
    fillStyle: '' as string,
    strokeStyle: '' as string,
    font: '10px sans-serif',
    lineWidth: 1,
    lineCap: 'butt' as CanvasLineCap,
    lineJoin: 'miter' as CanvasLineJoin,
    globalAlpha: 1,
    shadowColor: '',
    shadowBlur: 0,
    textAlign: 'left' as CanvasTextAlign,
  };
  return ctx;
}

export type MockCtx = ReturnType<typeof mockCardCtx>;

/** Канвас с подменённым контекстом + сам контекст для проверок fillText. */
export function canvasWithMockCtx() {
  const canvas = document.createElement('canvas');
  const ctx = mockCardCtx();
  vi.spyOn(canvas, 'getContext').mockReturnValue(
    ctx as unknown as CanvasRenderingContext2D,
  );
  return { canvas, ctx };
}

/** Всё, что карточка напечатала — одной строкой (для toContain). */
export function printedText(ctx: MockCtx): string {
  return ctx.printed.map((p) => p.text).join(' ');
}

/** Левый и правый край строки по выравниванию. */
export function textSpan(p: Printed): [number, number] {
  if (p.align === 'right' || p.align === 'end') return [p.x - p.width, p.x];
  if (p.align === 'center') return [p.x - p.width / 2, p.x + p.width / 2];
  return [p.x, p.x + p.width];
}
