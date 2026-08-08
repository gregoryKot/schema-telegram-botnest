// @vitest-environment jsdom
// compressImage: resize + JPEG-quality-ladder image compression. jsdom does
// not implement createImageBitmap/canvas rendering, so we stub the browser
// primitives ourselves and assert on the *inputs the code computes* (canvas
// size passed to drawImage, quality ladder passed to toDataURL) rather than
// real pixels — that's the actual logic under test here.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { compressImage } from './imageCompress';

function stubBitmap(width: number, height: number) {
  vi.stubGlobal(
    'createImageBitmap',
    vi.fn().mockResolvedValue({ width, height }),
  );
}

function stubCanvas(opts: {
  ctx: object | null;
  drawImage?: (...args: unknown[]) => void;
  toDataURL: (quality?: number) => string;
}) {
  const getContextSpy = vi.fn().mockReturnValue(
    opts.ctx === null
      ? null
      : { drawImage: opts.drawImage ?? vi.fn(), ...opts.ctx },
  );
  const toDataURLSpy = vi.fn(opts.toDataURL);
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(
    getContextSpy as unknown as typeof HTMLCanvasElement.prototype.getContext,
  );
  vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockImplementation(
    toDataURLSpy as unknown as typeof HTMLCanvasElement.prototype.toDataURL,
  );
  return { getContextSpy, toDataURLSpy };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('compressImage — масштабирование', () => {
  it('шире maxWidth — уменьшает canvas пропорционально', async () => {
    stubBitmap(2800, 1400);
    const drawImage = vi.fn();
    stubCanvas({ ctx: {}, drawImage, toDataURL: () => 'data:image/jpeg;base64,SHORT' });

    await compressImage(new File(['x'], 'a.jpg'), 1400, 200 * 1024);

    // scale = 1400/2800 = 0.5 → canvas 1400x700
    const [, , , w, h] = drawImage.mock.calls[0];
    expect(w).toBe(1400);
    expect(h).toBe(700);
  });

  it('уже уже maxWidth — не увеличивает (scale ограничен 1)', async () => {
    stubBitmap(400, 200);
    const drawImage = vi.fn();
    stubCanvas({ ctx: {}, drawImage, toDataURL: () => 'data:image/jpeg;base64,SHORT' });

    await compressImage(new File(['x'], 'a.jpg'), 1400, 200 * 1024);

    const [, , , w, h] = drawImage.mock.calls[0];
    expect(w).toBe(400);
    expect(h).toBe(200);
  });
});

describe('compressImage — лестница качества', () => {
  it('первый data URI уже укладывается в бюджет — quality не понижается, один вызов toDataURL', async () => {
    stubBitmap(800, 600);
    const { toDataURLSpy } = stubCanvas({
      ctx: {},
      toDataURL: () => 'data:image/jpeg;base64,SMALL',
    });

    const result = await compressImage(new File(['x'], 'a.jpg'), 1400, 200 * 1024);

    expect(result).toBe('data:image/jpeg;base64,SMALL');
    expect(toDataURLSpy).toHaveBeenCalledTimes(1);
    expect(toDataURLSpy).toHaveBeenCalledWith('image/jpeg', 0.85);
  });

  it('первые попытки превышают бюджет — quality понижается на 0.1 за шаг, пока не уложится', async () => {
    stubBitmap(800, 600);
    // Каждый вызов возвращает строку на 40 символов короче предыдущей.
    let call = 0;
    const { toDataURLSpy } = stubCanvas({
      ctx: {},
      toDataURL: () => {
        call += 1;
        // 3 больших ответа, затем маленький.
        return call < 4 ? 'x'.repeat(100) : 'x'.repeat(10);
      },
    });

    const result = await compressImage(new File(['x'], 'a.jpg'), 1400, 50);

    expect(result).toBe('x'.repeat(10));
    // 0.85 → 0.75 → 0.65 → 0.55 (4-й вызов укладывается)
    const qualities = toDataURLSpy.mock.calls.map((c) => c[1]);
    expect(qualities).toEqual([0.85, 0.75, 0.65, 0.55]);
  });

  it('даже на минимальном качестве (0.3) размер превышает бюджет — бросает понятную ошибку', async () => {
    stubBitmap(800, 600);
    stubCanvas({ ctx: {}, toDataURL: () => 'x'.repeat(1000) });

    await expect(
      compressImage(new File(['x'], 'a.jpg'), 1400, 50),
    ).rejects.toThrow('Не удалось сжать изображение до нужного размера');
  });
});

describe('compressImage — canvas не поддерживается', () => {
  it('getContext(2d) вернул null — бросает понятную ошибку, а не глотает молча', async () => {
    stubBitmap(800, 600);
    stubCanvas({ ctx: null, toDataURL: () => '' });

    await expect(
      compressImage(new File(['x'], 'a.jpg')),
    ).rejects.toThrow('Canvas не поддерживается');
  });
});
