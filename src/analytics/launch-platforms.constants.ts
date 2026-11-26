// Платформа, с которой сайт открыли внутри мессенджера (событие
// messenger_launch, server-events.constants.ts). Аудит 2026-10: платформа
// запуска (tgWebAppPlatform = weba/webk/ios/…) нигде не писалась, и тихую
// поломку одной платформы — например, Telegram Web в iframe — по /stats было
// не увидеть: общее число входов почти не проседает.
//
// Значение присылает клиент полем `platform` в обмене подписи на сессию
// (POST /api/auth/telegram/webapp и /api/auth/max/webapp). Клиенту верим
// только в пределах списка: всё незнакомое пишется как `other`. Копия списка
// на фронте — shared/src/host/launchPlatform.ts (бэкенд не импортирует
// shared/), сверка — launch-platforms.sync.spec.ts (правило №4).
//
// Значения Telegram (WebApp.platform): android, android_x (Telegram X), ios,
// macos, tdesktop, unigram, weba, webk, web (старый веб-клиент). MAX
// (WebApp.platform / WebAppPlatform в адресе): ios, android, desktop, web.
export const LAUNCH_HOSTS = ['max', 'telegram'] as const;
export type LaunchHost = (typeof LAUNCH_HOSTS)[number];

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

const PLATFORM_SET: ReadonlySet<string> = new Set(LAUNCH_PLATFORMS);

/** Незнакомое, пустое и не-строка — `other`: отчёт не видит сырых значений. */
export function normalizeLaunchPlatform(raw: unknown): LaunchPlatform {
  return typeof raw === 'string' && PLATFORM_SET.has(raw)
    ? (raw as LaunchPlatform)
    : 'other';
}

/** meta события messenger_launch — только площадка и платформа из списка. */
export function messengerLaunchMeta(
  host: LaunchHost,
  rawPlatform: unknown,
): { host: LaunchHost; platform: LaunchPlatform } {
  return { host, platform: normalizeLaunchPlatform(rawPlatform) };
}
