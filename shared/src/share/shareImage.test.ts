// @vitest-environment jsdom
// Каскад фолбэков shareCanvasImage — 0% покрытия до этого теста. Каждый тест
// пришпиливает один шаг каскада (файловый шэр → текстовый шэр → скачивание →
// ошибка «ничего не сработало»), чтобы вызывающий код (ShareCardSheet) мог
// положиться на конкретный результат/исключение, а не «что-то не упало».
import { describe, it, expect, vi, afterEach } from 'vitest';
import { shareCanvasImage } from './shareImage';

function fakeCanvas(blob: Blob | null): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.toBlob = vi.fn((cb: BlobCallback) => cb(blob));
  return canvas;
}

const PNG_BLOB = new Blob(['фейковый png'], { type: 'image/png' });

afterEach(() => {
  vi.restoreAllMocks();
  Reflect.deleteProperty(navigator, 'canShare');
  Reflect.deleteProperty(navigator, 'share');
});

describe('shareCanvasImage', () => {
  it('canvas.toBlob отдал null (пустой канвас) — падает с понятной ошибкой, до похода в navigator', async () => {
    const canShare = vi.fn();
    Object.defineProperty(navigator, 'canShare', {
      value: canShare,
      configurable: true,
    });
    await expect(
      shareCanvasImage(fakeCanvas(null), 'текст', 'card.png'),
    ).rejects.toThrow('canvas empty');
    expect(canShare).not.toHaveBeenCalled();
  });

  it('canShare(файл) поддержан — шарит файл с подписью, вызывает share ровно с этим файлом', async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'canShare', {
      value: vi.fn(() => true),
      configurable: true,
    });
    Object.defineProperty(navigator, 'share', {
      value: share,
      configurable: true,
    });

    const result = await shareCanvasImage(
      fakeCanvas(PNG_BLOB),
      'Мой день в дневнике',
      'day.png',
    );

    expect(result).toBe('shared');
    expect(share).toHaveBeenCalledTimes(1);
    const call = share.mock.calls[0][0] as { files: File[]; text: string };
    expect(call.text).toBe('Мой день в дневнике');
    expect(call.files).toHaveLength(1);
    expect(call.files[0].name).toBe('day.png');
    expect(call.files[0].type).toBe('image/png');
  });

  it('canShare есть, но вернул false (клиент не умеет шарить именно файлы) — падает на текстовый share', async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'canShare', {
      value: vi.fn(() => false),
      configurable: true,
    });
    Object.defineProperty(navigator, 'share', {
      value: share,
      configurable: true,
    });

    const result = await shareCanvasImage(
      fakeCanvas(PNG_BLOB),
      'Текст без файла',
      'x.png',
    );

    expect(result).toBe('shared');
    expect(share).toHaveBeenCalledWith({ text: 'Текст без файла' });
  });

  it('canShare отсутствует вовсе, share есть — текстовый share без упоминания файла', async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'share', {
      value: share,
      configurable: true,
    });

    const result = await shareCanvasImage(fakeCanvas(PNG_BLOB), 'т', 'x.png');

    expect(result).toBe('shared');
    expect(share).toHaveBeenCalledWith({ text: 'т' });
  });

  it('ни canShare, ни share — с downloadFallback: скачивает файл через ссылку, отзывает URL', async () => {
    const objectUrl = 'blob:fake-object-url';
    vi.spyOn(URL, 'createObjectURL').mockReturnValue(objectUrl);
    const revoke = vi
      .spyOn(URL, 'revokeObjectURL')
      .mockImplementation(() => {});
    const anchor = document.createElement('a');
    const click = vi.spyOn(anchor, 'click').mockImplementation(() => {});
    const canvas = fakeCanvas(PNG_BLOB);
    vi.spyOn(document, 'createElement').mockReturnValue(anchor);

    const result = await shareCanvasImage(canvas, 'т', 'card.png', {
      downloadFallback: true,
    });

    expect(result).toBe('downloaded');
    expect(anchor.getAttribute('href')).toBe(objectUrl);
    expect(anchor.getAttribute('download')).toBe('card.png');
    expect(click).toHaveBeenCalledTimes(1);
    expect(revoke).toHaveBeenCalledWith(objectUrl);
  });

  it('ни canShare, ни share, downloadFallback не запрошен — бросает «share unavailable», вызывающий покажет свой фолбэк', async () => {
    await expect(
      shareCanvasImage(fakeCanvas(PNG_BLOB), 'т', 'x.png'),
    ).rejects.toThrow('share unavailable');
  });
});
