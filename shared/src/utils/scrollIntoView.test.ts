// @vitest-environment jsdom
// Ж6 дизайн-аудита 2026-08: явный behavior:'smooth' в scrollIntoView сильнее
// CSS reduced-motion. Обе ветки — системная настройка и обычный режим.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { scrollIntoViewSafe } from './scrollIntoView';

const matchMedia = (matches: boolean) =>
  vi.fn().mockImplementation((query: string) => ({
    matches,
    media: query,
  }));

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
  document.documentElement.removeAttribute('data-reduce-motion');
});

describe('scrollIntoViewSafe', () => {
  it('обычный режим — behavior смещается на smooth, опции сохраняются', () => {
    window.matchMedia = matchMedia(false);
    const el = { scrollIntoView: vi.fn() } as unknown as Element;
    scrollIntoViewSafe(el, { block: 'nearest' });
    expect(el.scrollIntoView).toHaveBeenCalledWith({
      block: 'nearest',
      behavior: 'smooth',
    });
  });

  it('prefers-reduced-motion (системный) — behavior всегда auto', () => {
    window.matchMedia = matchMedia(true);
    const el = { scrollIntoView: vi.fn() } as unknown as Element;
    scrollIntoViewSafe(el, { block: 'center' });
    expect(el.scrollIntoView).toHaveBeenCalledWith({
      block: 'center',
      behavior: 'auto',
    });
  });

  it('ручной переключатель «меньше движения» тоже даёт auto', () => {
    window.matchMedia = matchMedia(false);
    localStorage.setItem('reduce_motion', '1');
    const el = { scrollIntoView: vi.fn() } as unknown as Element;
    scrollIntoViewSafe(el);
    expect(el.scrollIntoView).toHaveBeenCalledWith({ behavior: 'auto' });
  });

  it('null/undefined элемент — не падает, ничего не вызывает', () => {
    window.matchMedia = matchMedia(false);
    expect(() => scrollIntoViewSafe(null)).not.toThrow();
    expect(() => scrollIntoViewSafe(undefined)).not.toThrow();
  });
});
