// Заглушка 2d-контекста: в jsdom canvas не реализован, а ShareCardSheet рисует
// карточку сразу при открытии. Любой метод — vi.fn(), measureText даёт ширину.
import { vi } from 'vitest';

export function mockCanvas2d() {
  const ctx = new Proxy({} as Record<string, unknown>, {
    get: (_t, k) => {
      if (k === 'measureText') return (s: string) => ({ width: s.length * 7 });
      if (k === 'createLinearGradient' || k === 'createRadialGradient') {
        return () => ({ addColorStop: vi.fn() });
      }
      return vi.fn();
    },
    set: () => true,
  });
  return vi
    .spyOn(HTMLCanvasElement.prototype, 'getContext')
    .mockReturnValue(ctx as unknown as RenderingContext);
}
