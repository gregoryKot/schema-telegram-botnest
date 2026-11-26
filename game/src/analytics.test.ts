import { afterEach, describe, expect, it, vi } from 'vitest';
import { initAnalytics } from './analytics';

type Win = { ym?: ((...a: unknown[]) => void) & { a?: unknown[][]; l?: number }; location: Location };

describe('initAnalytics — загрузка Метрики', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('при согласии: очередь ym.a, ym.l и <script async> с id счётчика', () => {
    const script: { async?: boolean; src?: string } = {};
    const append = vi.fn();
    const win: Win = { location: { href: 'https://x/?src=bot', search: '?src=bot' } as Location };
    vi.stubGlobal('window', win);
    vi.stubGlobal('localStorage', { getItem: () => 'all' });
    vi.stubGlobal('document', { createElement: () => script, head: { appendChild: append } });
    vi.stubGlobal('fetch', () => Promise.resolve());
    initAnalytics();
    expect(script.async).toBe(true);
    expect(script.src).toBe('https://mc.yandex.ru/metrika/tag.js?id=109568051');
    expect(append).toHaveBeenCalledWith(script);
    expect(typeof win.ym?.l).toBe('number');
    expect(win.ym?.a?.map((c) => c[1])).toEqual(['init', 'hit']);
  });

  it('без согласия Метрика не грузится', () => {
    const win: Win = { location: { href: 'https://x/', search: '' } as Location };
    vi.stubGlobal('window', win);
    vi.stubGlobal('localStorage', { getItem: () => null });
    vi.stubGlobal('fetch', () => Promise.resolve());
    initAnalytics();
    expect(win.ym).toBeUndefined();
  });
});
