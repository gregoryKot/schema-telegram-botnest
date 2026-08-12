// Адаптер Telegram: вся специфика мессенджера собрана здесь, ядро приложения
// про `window.Telegram` больше не знает.
import type {
  HomeScreenStatus,
  HostBridge,
  HostCapabilities,
  HostInsets,
  HostUser,
} from './types';

type TgWebApp = {
  initData?: string;
  initDataUnsafe?: {
    start_param?: string;
    user?: { id: number; first_name: string; username?: string };
  };
  contentSafeAreaInset?: { top?: number };
  safeAreaInset?: { top?: number };
  isFullscreen?: boolean;
  platform?: string;
  colorScheme?: 'light' | 'dark';
  onEvent?(event: string, cb: () => void): void;
  offEvent?(event: string, cb: () => void): void;
  ready?(): void;
  expand?(): void;
  close?(): void;
  disableVerticalSwipes?(): void;
  enableVerticalSwipes?(): void;
  openLink?(url: string): void;
  addToHomeScreen?(): void;
  checkHomeScreenStatus?(cb: (status: HomeScreenStatus) => void): void;
  BackButton?: {
    show(): void;
    hide(): void;
    onClick(fn: () => void): void;
    offClick(fn: () => void): void;
  };
  HapticFeedback?: {
    impactOccurred(style: 'light' | 'medium' | 'heavy'): void;
    notificationOccurred(type: 'error' | 'success' | 'warning'): void;
    selectionChanged(): void;
  };
};

/** Клиенты Telegram нередко присылают инсеты с задержкой — перечитываем. */
const LATE_INSET_READS_MS = [150, 500];

export function telegramWebApp(): TgWebApp | undefined {
  return (globalThis as { Telegram?: { WebApp?: TgWebApp } }).Telegram?.WebApp;
}

/**
 * Наличия объекта МАЛО, чтобы считать себя открытым в Telegram.
 *
 * Их SDK (`/telegram-web-app.js`) мы подключаем в index.html безусловно, а он
 * создаёт `window.Telegram.WebApp` в любом окружении — хоть в MAX, хоть в
 * обычной вкладке. Пока детект смотрел только на объект, мини-апп внутри MAX
 * считал себя телеграмным: слал пустую телеграмную подпись, никогда не звал
 * обмен MAX и показывал «Telegram выдаст свежий пропуск» с кнопкой «закрыть»,
 * которой у MAX нет. В браузере по той же причине не мог показаться экран
 * входа.
 *
 * Признак настоящего Telegram берём из их же SDK: вне мессенджера он
 * оставляет `platform` равным `'unknown'`. Подпись годится как второй
 * признак — в мини-аппе она непустая.
 */
export function isTelegramContext(): boolean {
  const w = telegramWebApp();
  if (!w) return false;
  return (!!w.platform && w.platform !== 'unknown') || !!w.initData;
}

export function createTelegramHost(): HostBridge {
  const tg = () => telegramWebApp();
  // Факт события важнее числа: contentTop может прийти нулём.
  let contentReported = false;
  // Bot API 7.7+; в старых клиентах методов может не быть — вызов через `?.`.
  const setVerticalSwipes = (enabled: boolean) => {
    if (enabled) tg()?.enableVerticalSwipes?.();
    else tg()?.disableVerticalSwipes?.();
  };

  return {
    id: 'telegram',
    // Платформу и возможности читаем каждый раз, а не запоминаем при создании:
    // часть клиентов дозаполняет WebApp уже после загрузки скрипта.
    get platform(): string | undefined {
      return tg()?.platform;
    },
    get capabilities(): HostCapabilities {
      const w = tg();
      return {
        haptics: !!w?.HapticFeedback,
        backButton: !!w?.BackButton,
        homeScreen: !!w?.addToHomeScreen,
        close: true,
      };
    },

    ready: () => tg()?.ready?.(),
    // Вертикальные свайпы гасим вместе с разворотом: иначе жест внутри списка
    // сворачивает всё приложение.
    expand: () => {
      tg()?.expand?.();
      setVerticalSwipes(false);
    },
    close: () => tg()?.close?.(),
    setVerticalSwipes,

    user(): HostUser | null {
      const u = tg()?.initDataUnsafe?.user;
      if (!u) return null;
      return {
        id: String(u.id),
        firstName: u.first_name,
        username: u.username,
      };
    },
    startParam: () => tg()?.initDataUnsafe?.start_param ?? null,
    authHeaders: () => ({ 'x-telegram-init-data': tg()?.initData ?? '' }),
    sessionExchange() {
      const initData = tg()?.initData;
      return initData
        ? { path: '/api/auth/telegram/webapp', body: { initData } }
        : null;
    },

    colorScheme: () => tg()?.colorScheme ?? null,

    insets(): HostInsets {
      const w = tg();
      return {
        contentTop: w?.contentSafeAreaInset?.top,
        deviceTop: w?.safeAreaInset?.top,
        isFullscreen: !!w?.isFullscreen,
        contentReported,
        overlaysContent: true,
      };
    },
    onInsetsChange(cb) {
      const w = tg();
      if (!w) return () => {};
      const onContent = () => {
        contentReported = true;
        cb();
      };
      w.onEvent?.('safeAreaChanged', cb);
      w.onEvent?.('contentSafeAreaChanged', onContent);
      w.onEvent?.('fullscreenChanged', cb);
      const timers = LATE_INSET_READS_MS.map((ms) => setTimeout(cb, ms));
      return () => {
        w.offEvent?.('safeAreaChanged', cb);
        w.offEvent?.('contentSafeAreaChanged', onContent);
        w.offEvent?.('fullscreenChanged', cb);
        timers.forEach(clearTimeout);
      };
    },

    openLink: (url) => tg()?.openLink?.(url),
    // Файл отдаём системе: внутри вебвью мессенджера скачивания нет.
    saveFile: (dataUrl) => tg()?.openLink?.(dataUrl),

    haptic: {
      tap: () => tg()?.HapticFeedback?.impactOccurred('light'),
      press: () => tg()?.HapticFeedback?.impactOccurred('medium'),
      select: () => tg()?.HapticFeedback?.selectionChanged(),
      success: () => tg()?.HapticFeedback?.notificationOccurred('success'),
      warning: () => tg()?.HapticFeedback?.notificationOccurred('warning'),
      error: () => tg()?.HapticFeedback?.notificationOccurred('error'),
    },

    backButton: {
      setVisible(visible) {
        const bb = tg()?.BackButton;
        if (!bb) return;
        if (visible) bb.show();
        else bb.hide();
      },
      onClick(cb) {
        const bb = tg()?.BackButton;
        if (!bb) return () => {};
        bb.onClick(cb);
        return () => bb.offClick(cb);
      },
    },

    homeScreen: {
      add: () => tg()?.addToHomeScreen?.(),
      checkStatus: (cb) => tg()?.checkHomeScreenStatus?.(cb),
      onAdded(cb) {
        const w = tg();
        if (!w) return () => {};
        w.onEvent?.('homeScreenAdded', cb);
        return () => w.offEvent?.('homeScreenAdded', cb);
      },
    },
  };
}
