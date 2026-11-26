// @vitest-environment jsdom
// Устаревший чанк после деплоя: текст ошибки трёх движков и защита от цикла
// перезагрузок (инцидент 2026-10-19, Safari).
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { isChunkLoadError, reloadForFreshChunks } from './chunkReload';

describe('isChunkLoadError', () => {
  it.each([
    'Failed to fetch dynamically imported module: https://x/assets/a.js', // Chrome
    'Importing a module script failed.', // Safari
    'error loading dynamically imported module', // Firefox
    'Loading chunk 3 failed',
    'Unable to preload CSS for /assets/a.css', // Vite preload
  ])('«%s» — устаревший чанк', (m) => {
    expect(isChunkLoadError(m)).toBe(true);
  });

  it.each([
    'e is not iterable',
    'Cannot read properties of undefined',
    '',
    undefined,
    null,
  ])('«%s» — обычная ошибка, не чанк', (m) => {
    expect(isChunkLoadError(m)).toBe(false);
  });
});

describe('reloadForFreshChunks', () => {
  const reload = vi.fn();
  beforeEach(() => {
    reload.mockReset();
    sessionStorage.clear();
    Object.defineProperty(window, 'location', {
      value: { ...window.location, reload },
      writable: true,
    });
  });

  it('первый раз перезагружает и ставит метку', () => {
    expect(reloadForFreshChunks(1_000_000)).toBe(true);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('повтор в течение минуты — без перезагрузки (нет цикла)', () => {
    reloadForFreshChunks(1_000_000);
    expect(reloadForFreshChunks(1_030_000)).toBe(false);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('следующий деплой позже минуты — снова перезагружает', () => {
    reloadForFreshChunks(1_000_000);
    expect(reloadForFreshChunks(1_100_000)).toBe(true);
    expect(reload).toHaveBeenCalledTimes(2);
  });
});

describe('installChunkReloadListener', () => {
  it('vite:preloadError перезагружает страницу и гасит событие', async () => {
    const { installChunkReloadListener } = await import('./chunkReload');
    const reload = vi.fn();
    Object.defineProperty(window, 'location', {
      value: { ...window.location, reload },
      writable: true,
    });
    sessionStorage.clear();
    installChunkReloadListener();
    const event = new Event('vite:preloadError', { cancelable: true });
    window.dispatchEvent(event);
    expect(reload).toHaveBeenCalledTimes(1);
    expect(event.defaultPrevented).toBe(true);
  });
});
