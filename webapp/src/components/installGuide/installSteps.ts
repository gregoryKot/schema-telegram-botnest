import { detectInstallPlatform, type InstallPlatform } from '../../utils/pwaInstall';
import { detectInstallBrowser, type InstallBrowser } from '../../utils/installBrowser';
import { BROWSER_STEPS, type BrowserSteps } from './browserSteps';

// Шаги «значок на экран» — единственный источник текста для лендинга (AppInstallSection), /install и
// настроек: одна механика — один источник. Платформа показывает шаги своего главного браузера.
export interface InstallStepsBlock extends BrowserSteps {
  platform: InstallPlatform;
  /** Заголовок карточки на лендинге. */
  title: string;
}

export const INSTALL_STEPS: Record<InstallPlatform, InstallStepsBlock> = {
  ios: { platform: 'ios', title: 'iPhone и iPad', ...BROWSER_STEPS['ios-safari'] },
  android: { platform: 'android', title: 'Android', ...BROWSER_STEPS['android-chrome'] },
  desktop: {
    platform: 'desktop',
    title: 'Компьютер',
    browser: 'В Chrome или Яндекс Браузере:',
    steps: [
      'Значок установки у правого края адресной строки',
      'Или меню браузера → «Сохранить и поделиться» → «Установить…»',
    ],
  },
};

/** Шаги для посетителя: заголовок — его системы, подводка, шаги и ролик — его браузера. */
export function installGuide(platform: InstallPlatform, browser: InstallBrowser | null): InstallStepsBlock {
  return browser ? { ...INSTALL_STEPS[platform], ...BROWSER_STEPS[browser] } : INSTALL_STEPS[platform];
}
export const visitorInstallGuide = (): InstallStepsBlock => installGuide(detectInstallPlatform(), detectInstallBrowser());
