// Адаптер обычного браузера: приложение открыто не в мессенджере, а на
// schemehappens.ru/app/ или с иконки на домашнем экране.
//
// Половина возможностей мессенджера тут отсутствует физически — вкладку не
// закрыть изнутри, значок ставит сам браузер. Такие места честно помечены
// в capabilities, чтобы экран прятал кнопку, а не показывал мёртвую.
import type { HostBridge, HostCapabilities, HostInsets } from './types';

/** Приложение открыто с иконки, а не как вкладка сайта. */
export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia?.('(display-mode: standalone)').matches === true ||
    (navigator as { standalone?: boolean }).standalone === true
  );
}

// Вибрируем только в установленном приложении: на сайте, открытом вкладкой,
// дрожь от каждого тапа — неожиданность, а не отклик.
const canVibrate = (): boolean =>
  typeof navigator !== 'undefined' &&
  typeof navigator.vibrate === 'function' &&
  isStandalone();

const vibrate = (pattern: number | number[]): void => {
  if (canVibrate()) navigator.vibrate(pattern);
};

/**
 * iOS/Android определяем по UA — значение того же вида, что даёт Telegram.
 * Экспортирован: webapp строит на нём выбор шагов установки PWA
 * (webapp/src/utils/pwaInstall.ts) — второй UA-парсер запрещён правилом №3.
 * Параметры — только для тестов, в проде читаются из navigator.
 */
export function webPlatform(ua?: string, maxTouchPoints?: number): string {
  if (ua === undefined && typeof navigator === 'undefined') return 'web';
  const agent = ua ?? navigator.userAgent;
  const touch =
    maxTouchPoints ??
    (typeof navigator === 'undefined' ? 0 : (navigator.maxTouchPoints ?? 0));
  if (/iPhone|iPad|iPod/.test(agent)) return 'ios';
  // iPadOS 13+ прикидывается маком — отличаем по мультитачу.
  if (/Macintosh/i.test(agent) && touch > 1) return 'ios';
  if (/Android/.test(agent)) return 'android';
  return 'web';
}

/** Глубокая ссылка вида /app/?startapp=… — веб-аналог start_param. */
function urlStartParam(): string | null {
  if (typeof window === 'undefined') return null;
  const q = new URLSearchParams(window.location.search);
  return q.get('startapp') ?? q.get('start_param');
}

export function createWebHost(): HostBridge {
  return {
    id: 'web',
    platform: webPlatform(),
    get capabilities(): HostCapabilities {
      return {
        haptics: canVibrate(),
        // Кнопку «назад» даёт сам браузер — своей рисовать не нужно.
        backButton: false,
        // Значок ставит браузер (beforeinstallprompt / «На экран „Домой“»).
        homeScreen: false,
        close: false,
      };
    },

    ready: () => {},
    expand: () => {},
    close: () => {},
    // Браузер не перехватывает вертикальные жесты как «свернуть» — гасить
    // нечего, страховку на время драга берёт вызывающий код.
    setVerticalSwipes: () => {},

    user: () => null,
    startParam: urlStartParam,
    // В браузере вход по JWT: заголовок первичной авторизации не нужен.
    authHeaders: () => ({}),
    // Подписи хоста нет — сессию держит refresh-кука, выданная при входе.
    sessionExchange: () => null,

    // Своей темы у браузера нет — решает системная настройка.
    colorScheme: () => null,

    insets: (): HostInsets => ({
      contentTop: 0,
      deviceTop: 0,
      isFullscreen: false,
      // Чёлку и home-индикатор закрывает CSS env(safe-area-inset-*).
      contentReported: true,
      overlaysContent: false,
    }),
    onInsetsChange: () => () => {},

    openLink: (url) => {
      if (typeof window !== 'undefined')
        window.open(url, '_blank', 'noopener,noreferrer');
    },

    // data:-ссылку в новой вкладке браузеры блокируют — отдаём файл ссылкой
    // на скачивание.
    saveFile: (dataUrl, filename) => {
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
    },

    haptic: {
      tap: () => vibrate(10),
      press: () => vibrate(20),
      select: () => vibrate(5),
      success: () => vibrate([10, 40, 10]),
      warning: () => vibrate([20, 40, 20]),
      error: () => vibrate([30, 40, 30]),
    },

    backButton: {
      setVisible: () => {},
      onClick: () => () => {},
    },

    homeScreen: {
      add: () => {},
      checkStatus: (cb) => cb('unsupported'),
      onAdded: () => () => {},
    },
  };
}
