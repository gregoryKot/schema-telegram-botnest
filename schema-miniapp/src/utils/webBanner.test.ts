// Тест логики скрытия баннеров «полная версия — на сайте» (кабинет терапевта).
// localStorage замокан обычным объектом, как в outbox.test.ts.
import { describe, it, expect, beforeEach } from 'vitest';
import { isWebBannerDismissed, dismissWebBanner } from './webBanner';
import { createLocalStorageMock } from './localStorageMock';

beforeEach(() => {
  (globalThis as { localStorage: unknown }).localStorage =
    createLocalStorageMock();
});

describe('webBanner dismissal', () => {
  it('по умолчанию баннер не скрыт', () => {
    expect(isWebBannerDismissed('cabinet_full')).toBe(false);
    expect(isWebBannerDismissed('mode_map')).toBe(false);
  });

  it('после dismiss скрыт только этот баннер', () => {
    dismissWebBanner('cabinet_full');
    expect(isWebBannerDismissed('cabinet_full')).toBe(true);
    expect(isWebBannerDismissed('mode_map')).toBe(false);
  });

  it('скрытие переживает «перезапуск» (читается заново из storage)', () => {
    dismissWebBanner('mode_map');
    expect(localStorage.getItem('web_banner_dismissed:mode_map')).toBe('1');
    expect(isWebBannerDismissed('mode_map')).toBe(true);
  });

  it('не падает без localStorage (приватный режим)', () => {
    (globalThis as { localStorage: unknown }).localStorage = {
      getItem: () => {
        throw new Error('denied');
      },
      setItem: () => {
        throw new Error('denied');
      },
    };
    expect(isWebBannerDismissed('cabinet_full')).toBe(false);
    expect(() => dismissWebBanner('cabinet_full')).not.toThrow();
  });
});
