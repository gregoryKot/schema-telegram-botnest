import type { InstallBrowser } from '../../utils/installBrowser';

// Шаги «значок на экран» по браузерам телефона — в том же порядке, что кадры ролика этого браузера
// (webapp/public/install/, генератор — scripts/install-video/). Формулировки безличные.
export interface BrowserSteps {
  /** Подводка: в каком браузере это работает. */
  browser: string;
  steps: string[];
  /** Ролик с теми же шагами (у компьютера его нет). */
  video?: string;
}

const IOS_SHEET = [
  'Круглая кнопка со стрелкой вниз — список раскроется целиком',
  'В списке — «На экран „Домой“»',
  '«Добавить» справа вверху — значок встанет рядом с приложениями',
];

export const BROWSER_STEPS: Record<InstallBrowser, BrowserSteps> = {
  'ios-safari': {
    browser: 'В Safari:',
    steps: ['Кнопка ⋯ у адресной строки, в ней — «Поделиться» (на iOS до 26 — сразу квадрат со стрелкой вверх)', ...IOS_SHEET],
    video: '/install/install-ios-safari.mp4',
  },
  'ios-chrome': {
    browser: 'В Chrome:',
    steps: ['Кнопка «Поделиться» справа в адресной строке', ...IOS_SHEET],
    video: '/install/install-ios-chrome.mp4',
  },
  'android-chrome': {
    browser: 'В Chrome:',
    steps: [
      'Меню ⋮ справа вверху',
      'Внизу списка — «Установить и создать ярлык» (в старых версиях — «Добавить на главный экран»)',
      '«Установить» и ещё раз «Установить» — значок появится на экране',
    ],
    video: '/install/install-android-chrome.mp4',
  },
  'android-yandex': {
    browser: 'В Яндекс Браузере:',
    steps: [
      'Меню ⋮ у адресной строки',
      '«Добавить ярлык на телефон»',
      '«Добавить» — значок появится на экране',
    ],
    video: '/install/install-android-yandex.mp4',
  },
};
