// Рисование фона/рамки/декора пина Pinterest. pin-image.spec.ts гоняет эти
// функции только косвенно (через renderPhrasePin со случайно подобранным
// стилем) — часть углов/веток декора там могла ни разу не выпасть. Здесь
// стиль задаётся явно, чтобы каждая ветка была проверена детерминированно, а
// не «повезло — не повезло» при следующем запуске.
import { drawBackdrop, drawFrame, drawDecor } from './pin-draw';
import type { PinCorner, PinDecor, PinStyle } from './pin-style';

/** Минимальный поддельный canvas-контекст: пишет вызовы в массив логов. */
function makeCtx() {
  const calls: string[] = [];
  const gradient = { addColorStop: jest.fn() };
  const ctx = {
    fillStyle: '',
    globalAlpha: 1,
    strokeStyle: '',
    lineWidth: 0,
    font: '',
    fillRect: jest.fn((...a: number[]) =>
      calls.push(`fillRect:${a.join(',')}`),
    ),
    strokeRect: jest.fn((...a: number[]) =>
      calls.push(`strokeRect:${a.join(',')}`),
    ),
    createRadialGradient: jest.fn(() => {
      calls.push('radial');
      return gradient;
    }),
    createLinearGradient: jest.fn((...a: number[]) => {
      calls.push(`linear:${a.join(',')}`);
      return gradient;
    }),
    fillText: jest.fn((text: string) => calls.push(`fillText:${text}`)),
    beginPath: jest.fn(() => calls.push('beginPath')),
    arc: jest.fn((...a: number[]) => calls.push(`arc:${a.join(',')}`)),
    fill: jest.fn(() => calls.push('fill')),
  };
  return {
    ctx: ctx as unknown as Parameters<typeof drawBackdrop>[0],
    calls,
    gradient,
  };
}

const palette = (dark: boolean) => ({
  name: dark ? 'ночь' : 'песок',
  bg: dark ? '#111' : '#eee',
  bgTo: dark ? '#222' : '#ddd',
  fg: dark ? '255,255,255' : '0,0,0',
  accent: '#8f86ff',
  dark,
});

const style = (patch: Partial<PinStyle> = {}): PinStyle => ({
  palette: palette(true),
  layout: 'center',
  backdrop: 'vertical',
  corner: 'tl',
  decor: 'none',
  fontSize: 60,
  lineHeight: 86,
  ...patch,
});

describe('drawBackdrop', () => {
  it('vertical/diagonal — линейный градиент сверху вниз или по диагонали', () => {
    const { ctx: v, calls: vCalls } = makeCtx();
    drawBackdrop(v, style({ backdrop: 'vertical' }));
    expect(vCalls.some((c) => c.startsWith('linear:0,0,0,'))).toBe(true);

    const { ctx: d, calls: dCalls } = makeCtx();
    drawBackdrop(d, style({ backdrop: 'diagonal' }));
    expect(
      dCalls.some(
        (c) => c.startsWith('linear:0,0,') && !c.includes('linear:0,0,0,'),
      ),
    ).toBe(true);
  });

  it('glow — радиальный градиент из угла, без второй заливки поверх', () => {
    const { ctx, calls } = makeCtx();
    drawBackdrop(ctx, style({ backdrop: 'glow', corner: 'br' }));
    expect(calls).toContain('radial');
    // glow не идёт дальше на линейный градиент — заливка одна.
    expect(calls.filter((c) => c.startsWith('fillRect')).length).toBe(2);
  });

  it.each<PinCorner>(['tl', 'tr', 'bl', 'br'])(
    'glow из угла %s не падает и рисует пятно света',
    (corner) => {
      const { ctx, calls } = makeCtx();
      expect(() =>
        drawBackdrop(ctx, style({ backdrop: 'glow', corner })),
      ).not.toThrow();
      expect(calls).toContain('radial');
    },
  );
});

describe('drawFrame', () => {
  it('рисует рамку-инсет заданным цветом', () => {
    const { ctx, calls } = makeCtx();
    drawFrame(ctx, style({ palette: palette(false) }));
    expect(calls.some((c) => c.startsWith('strokeRect'))).toBe(true);
  });
});

describe('drawDecor', () => {
  const cases: PinDecor[] = ['quote', 'dot', 'rule', 'none'];

  it.each(cases)('декор «%s» не роняет рендер', (decor) => {
    const { ctx } = makeCtx();
    expect(() => drawDecor(ctx, style({ decor }), 90, 300)).not.toThrow();
  });

  it('quote рисует крупную кавычку текстом, не фигурой', () => {
    const { ctx, calls } = makeCtx();
    drawDecor(ctx, style({ decor: 'quote' }), 90, 300);
    expect(calls).toContain('fillText:«');
    expect(calls.some((c) => c.startsWith('arc'))).toBe(false);
  });

  it('dot рисует кружок через arc+fill', () => {
    const { ctx, calls } = makeCtx();
    drawDecor(ctx, style({ decor: 'dot' }), 90, 300);
    expect(calls).toContain('beginPath');
    expect(calls.some((c) => c.startsWith('arc'))).toBe(true);
    expect(calls).toContain('fill');
  });

  it('rule рисует прямоугольную черту через fillRect', () => {
    const { ctx, calls } = makeCtx();
    drawDecor(ctx, style({ decor: 'rule' }), 90, 300);
    expect(calls.some((c) => c.startsWith('fillRect'))).toBe(true);
    expect(calls.some((c) => c.startsWith('arc'))).toBe(false);
  });

  it('none ничего не рисует — фраза звучит без украшений', () => {
    const { ctx, calls } = makeCtx();
    drawDecor(ctx, style({ decor: 'none' }), 90, 300);
    expect(calls).toEqual([]);
  });
});
