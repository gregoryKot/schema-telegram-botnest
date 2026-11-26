// Платформа запуска внутри мессенджера — поле `platform` в обмене подписи на
// сессию (sessionExchange в telegram.ts и max.ts). Сервер пишет его в событие
// messenger_launch, и /stats показывает запуски по платформам: тихую поломку
// одной платформы (Telegram Web в iframe, MAX на компьютере) иначе не видно
// (аудит 2026-10). Парный список на бэкенде —
// src/analytics/launch-platforms.constants.ts; сверка — его sync-спек.
//
// Значения Telegram (WebApp.platform): android, android_x, ios, macos,
// tdesktop, unigram, weba, webk, web. MAX: ios, android, desktop, web.
export const LAUNCH_PLATFORMS = [
  'android',
  'android_x',
  'desktop',
  'ios',
  'macos',
  'other',
  'tdesktop',
  'unigram',
  'web',
  'weba',
  'webk',
] as const;
export type LaunchPlatform = (typeof LAUNCH_PLATFORMS)[number];

/** Незнакомое и пустое — `other`: сырое значение клиента на сервер не уходит. */
export function launchPlatform(raw: string | undefined): LaunchPlatform {
  return (LAUNCH_PLATFORMS as readonly string[]).includes(raw ?? '')
    ? (raw as LaunchPlatform)
    : 'other';
}
