// Итог шэра карточки: отмена системной шторки отличается от сбоя, скачанная
// картинка — от системного шэра.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { isShareAbort, shareButtonLabel, shareOutcome } from './shareOutcome';

const shareCanvasImage = vi.hoisted(() => vi.fn());
vi.mock('./shareImage', () => ({ shareCanvasImage }));

const canvas = {} as HTMLCanvasElement;

beforeEach(() => {
  shareCanvasImage.mockReset();
});

describe('isShareAbort', () => {
  it('AbortError (DOMException и Error с тем же именем) — отмена', () => {
    expect(isShareAbort(new DOMException('Share canceled', 'AbortError'))).toBe(
      true,
    );
    const e = new Error('aborted');
    e.name = 'AbortError';
    expect(isShareAbort(e)).toBe(true);
  });

  it('прочие ошибки и не-объекты — не отмена', () => {
    expect(isShareAbort(new DOMException('denied', 'NotAllowedError'))).toBe(
      false,
    );
    expect(isShareAbort(new Error('share unavailable'))).toBe(false);
    expect(isShareAbort('AbortError')).toBe(false);
    expect(isShareAbort(null)).toBe(false);
    expect(isShareAbort(undefined)).toBe(false);
  });
});

describe('shareOutcome', () => {
  it('просит скачивание как запасной путь и отдаёт итог shareCanvasImage', async () => {
    shareCanvasImage.mockResolvedValueOnce('shared');
    await expect(shareOutcome(canvas, 'текст', 'card.png')).resolves.toBe(
      'shared',
    );
    expect(shareCanvasImage).toHaveBeenCalledWith(canvas, 'текст', 'card.png', {
      downloadFallback: true,
    });
    shareCanvasImage.mockResolvedValueOnce('downloaded');
    await expect(shareOutcome(canvas, 'текст', 'card.png')).resolves.toBe(
      'downloaded',
    );
  });

  it('AbortError → cancelled, любая другая ошибка → failed; не бросает', async () => {
    shareCanvasImage.mockRejectedValueOnce(
      new DOMException('Share canceled', 'AbortError'),
    );
    await expect(shareOutcome(canvas, 't', 'f.png')).resolves.toBe('cancelled');
    shareCanvasImage.mockRejectedValueOnce(new Error('canvas empty'));
    await expect(shareOutcome(canvas, 't', 'f.png')).resolves.toBe('failed');
  });
});

describe('shareButtonLabel', () => {
  it('подготовка важнее «сохранена»; скачанная картинка — видимый итог', () => {
    expect(shareButtonLabel(true, true)).toBe('Готовлю картинку…');
    expect(shareButtonLabel(false, true)).toBe('✓ Картинка сохранена');
    expect(shareButtonLabel(false, false)).toBe('Поделиться');
  });
});
