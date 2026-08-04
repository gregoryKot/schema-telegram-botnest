// @vitest-environment jsdom
// Отрисовка радара/плиток/полоски прогресса (charts.ts) — самый большой
// непокрытый файл кита карточек (0% статей до этого теста): axisPoint и
// valueRadius уже проверены в kit.test.ts как чистая геометрия, здесь же
// прогоняем сами draw*-функции с фейковым Card (ctx-мок + минимальная тема,
// без настоящего canvas — см. комментарий practiceCard.test.ts, jsdom не
// реализует 2d-контекст). Цель — не уронить рисование на граничных значениях
// (пустые точки, нулевая доля, пустой центр), а не побайтовый пиксель.
import { describe, it, expect, vi } from 'vitest';
import { drawRadar, drawStatTiles, progressBar } from './charts';
import type { Card } from './frame';
import type { CardTheme } from './theme';

function mockCtx() {
  return {
    save: vi.fn(),
    restore: vi.fn(),
    beginPath: vi.fn(),
    closePath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    arc: vi.fn(),
    stroke: vi.fn(),
    fill: vi.fn(),
    fillRect: vi.fn(),
    fillText: vi.fn(),
    roundRect: vi.fn(),
    createLinearGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
    createRadialGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
    measureText: vi.fn((s: string) => ({ width: s.length * 7 })),
    fillStyle: '',
    strokeStyle: '',
    font: '',
    lineWidth: 1,
    shadowColor: '',
    shadowBlur: 0,
    textAlign: 'left' as CanvasTextAlign,
  };
}

function mockTheme(): CardTheme {
  return {
    bg: '#191b25',
    sheetBg: '#23252f',
    accent: '#8f86ff',
    isLight: false,
    fg: (alpha: number) => `rgba(255,255,255,${alpha})`,
    color: (v: string) => v,
  };
}

function mockCard(ctx: ReturnType<typeof mockCtx>): Card {
  return {
    ctx: ctx as unknown as CanvasRenderingContext2D,
    W: 400,
    H: 500,
    th: mockTheme(),
    accent: '#8f86ff',
    accent2: '#4fa3f7',
  };
}

describe('drawRadar', () => {
  it('не падает на пустых значениях (потребность не отмечена — null)', () => {
    const c = mockCard(mockCtx());
    expect(() =>
      drawRadar(
        c,
        [
          { emoji: '🤝', color: '#5aa8f7', value: null },
          { emoji: '🧭', color: '#a78bfa', value: 5 },
        ],
        { cx: 200, cy: 200, r: 90 },
      ),
    ).not.toThrow();
  });

  it('рисует крупное значение в центре, когда center передан', () => {
    const ctx = mockCtx();
    const c = mockCard(ctx);
    drawRadar(c, [{ emoji: '🤝', color: '#5aa8f7', value: 7 }], {
      cx: 200,
      cy: 200,
      r: 90,
      center: { value: '7.0', caption: 'индекс' },
    });
    // Центр рисует и число, и подпись — минимум два fillText сверх осей.
    expect(ctx.fillText).toHaveBeenCalledWith('7.0', 200, 203);
  });

  it('без center отдельный текст в середину не рисуется', () => {
    const ctx = mockCtx();
    const c = mockCard(ctx);
    drawRadar(c, [{ emoji: '🤝', color: '#5aa8f7', value: 7 }], {
      cx: 200,
      cy: 200,
      r: 90,
    });
    expect(ctx.fillText).not.toHaveBeenCalledWith('7.0', 200, 203);
  });

  it('одна точка — не роняет геометрию (n=1)', () => {
    const c = mockCard(mockCtx());
    expect(() =>
      drawRadar(c, [{ emoji: '🤝', color: '#5aa8f7', value: 3 }], {
        cx: 200,
        cy: 200,
        r: 90,
      }),
    ).not.toThrow();
  });
});

describe('drawStatTiles', () => {
  it('возвращает Y ниже плиток и рисует hint только когда он есть', () => {
    const ctx = mockCtx();
    const c = mockCard(ctx);
    const yWith = drawStatTiles(
      c,
      [{ label: 'Серия', value: '7', hint: 'дней' }],
      100,
    );
    expect(yWith).toBeGreaterThan(100);
    expect(ctx.fillText).toHaveBeenCalledWith(
      'дней',
      expect.any(Number),
      expect.any(Number),
    );
  });

  it('несколько плиток делят ширину карточки поровну (не падает при делении)', () => {
    const c = mockCard(mockCtx());
    expect(() =>
      drawStatTiles(
        c,
        [
          { label: 'A', value: '1' },
          { label: 'B', value: '2' },
          { label: 'C', value: '3' },
        ],
        50,
      ),
    ).not.toThrow();
  });

  it('пустой список плиток не падает', () => {
    const c = mockCard(mockCtx());
    expect(() => drawStatTiles(c, [], 50)).not.toThrow();
  });
});

describe('progressBar', () => {
  it('pct=0 не рисует заполненную часть — ранний выход после подложки', () => {
    const ctx = mockCtx();
    const c = mockCard(ctx);
    ctx.roundRect.mockClear();
    progressBar(c, 10, 10, 200, 0, '#8f86ff');
    // Подложка — один roundRect; заполнение при pct<=0 не добавляется.
    expect(ctx.roundRect).toHaveBeenCalledTimes(1);
  });

  it('pct=1 заполняет на всю ширину без исключений', () => {
    const c = mockCard(mockCtx());
    expect(() => progressBar(c, 10, 10, 200, 1, '#8f86ff')).not.toThrow();
  });

  it('pct за пределами 0..1 обрезается, а не ломает раскладку', () => {
    const c = mockCard(mockCtx());
    expect(() => progressBar(c, 10, 10, 200, 5, '#8f86ff')).not.toThrow();
    expect(() => progressBar(c, 10, 10, 200, -3, '#8f86ff')).not.toThrow();
  });
});
