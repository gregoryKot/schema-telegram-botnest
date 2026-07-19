// Баннеры «полная версия — на сайте» в кабинете терапевта мини-аппа.
// Скрытие — навсегда, per-баннер, в localStorage этого устройства.
// Парный allow-list id на бэке: src/analytics/analytics.constants.ts
// (WEB_BANNER_IDS) — при добавлении баннера синхронь оба списка.

export type WebBannerId = 'cabinet_full' | 'mode_map';

export const WEB_APP_URL = 'https://schemehappens.ru';
export const WEB_CABINET_URL = `${WEB_APP_URL}/cabinet`;

const KEY_PREFIX = 'web_banner_dismissed:';

export function isWebBannerDismissed(id: WebBannerId): boolean {
  try {
    return localStorage.getItem(KEY_PREFIX + id) === '1';
  } catch {
    return false;
  }
}

export function dismissWebBanner(id: WebBannerId): void {
  try {
    localStorage.setItem(KEY_PREFIX + id, '1');
  } catch {
    // localStorage недоступен (приватный режим) — баннер просто скроется до перезапуска
  }
}
