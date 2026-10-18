import type { InstallPlatform } from '../../utils/pwaInstall';

// Шаги «значок на экран» по платформам — единственный источник текста для
// баннера кабинета (InstallAppGuide) и лендинга (AppInstallSection): одна
// механика — один источник, иначе формулировки разъедутся. Формулировки
// безличные: инструкцию видят и «ты», и «вы», и анонимный гость лендинга.
export interface InstallStepsBlock {
  platform: InstallPlatform;
  /** Заголовок карточки на лендинге. */
  title: string;
  /** Подводка: в каком браузере это работает. */
  browser: string;
  steps: string[];
}

export const INSTALL_STEPS: Record<InstallPlatform, InstallStepsBlock> = {
  ios: {
    platform: 'ios',
    title: 'iPhone и iPad',
    browser: 'В Safari:',
    steps: [
      'Кнопка «Поделиться» — квадрат со стрелкой вверх',
      'В списке — «На экран „Домой“»',
      '«Добавить» справа вверху — значок встанет рядом с приложениями',
    ],
  },
  android: {
    platform: 'android',
    title: 'Android',
    browser: 'В Chrome:',
    steps: [
      'Меню ⋮ справа вверху',
      '«Добавить на главный экран» или «Установить приложение»',
      'Подтвердить — значок появится на экране',
    ],
  },
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
