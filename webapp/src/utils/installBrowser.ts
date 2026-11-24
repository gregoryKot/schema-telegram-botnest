import { detectInstallPlatform } from './pwaInstall';

/** Браузер телефона, у которого свой путь к «значку на экран» (свои шаги и свой ролик). */
export type InstallBrowser = 'ios-safari' | 'ios-chrome' | 'android-chrome' | 'android-yandex';

/** Браузер для шагов и ролика. Незнакомый браузер получает главный для своей системы
 *  (iPhone — Safari, Android — Chrome); компьютер — null: ролика для него нет. */
export function detectInstallBrowser(ua?: string, maxTouchPoints?: number): InstallBrowser | null {
  const platform = detectInstallPlatform(ua, maxTouchPoints);
  if (platform === 'desktop') return null;
  const agent = ua ?? navigator.userAgent;
  if (platform === 'ios') return /CriOS\//.test(agent) ? 'ios-chrome' : 'ios-safari';
  return /YaBrowser\//.test(agent) ? 'android-yandex' : 'android-chrome';
}
