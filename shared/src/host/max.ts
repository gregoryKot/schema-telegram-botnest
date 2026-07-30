// Адаптер MAX: мессенджер грузит Bridge через CDN-скрипт и создаёт
// window.WebApp сразу, без отдельной инициализации — в отличие от Telegram,
// готовности ждать не нужно.
import type {
  HostBridge,
  HostCapabilities,
  HostInsets,
  HostUser,
} from './types';

type MaxWebApp = {
  initData?: string;
  initDataUnsafe?: {
    start_param?: string;
    user?: {
      id: number;
      first_name: string;
      username?: string | null;
    };
  };
  platform?: string;
  BackButton?: {
    show(): void;
    hide(): void;
    onClick(fn: () => void): void;
    offClick(fn: () => void): void;
  };
  HapticFeedback?: {
    impactOccurred(
      style: 'soft' | 'light' | 'medium' | 'heavy' | 'rigid',
    ): void;
    notificationOccurred(type: 'error' | 'success' | 'warning'): void;
    selectionChanged(): void;
  };
  openLink?(url: string): void;
  openMaxLink?(url: string): void;
  downloadFile?(url: string, filename: string): void;
};

/** MAX отдаёт хаптики только на мобильных клиентах — на десктопе и в вебе они документированно не работают. */
const HAPTIC_PLATFORMS = new Set(['ios', 'android']);

export function maxWebApp(): MaxWebApp | undefined {
  // Имя window.WebApp слишком общее, чтобы верить ему на слово — под этим
  // же именем может оказаться объект из совсем другой библиотеки на
  // странице. Считаем его MAX Bridge только если видим хотя бы один
  // характерный признак.
  const w = (globalThis as { WebApp?: MaxWebApp }).WebApp;
  if (!w) return undefined;
  const looksLikeMax =
    'initData' in w || 'initDataUnsafe' in w || 'BackButton' in w;
  return looksLikeMax ? w : undefined;
}

/** Диплинк max.ru открываем внутри мессенджера, остальные ссылки — во внешнем браузере. */
function isMaxDeepLink(url: string): boolean {
  try {
    const { hostname } = new URL(url);
    return hostname === 'max.ru' || hostname.endsWith('.max.ru');
  } catch {
    return false;
  }
}

export function createMaxHost(): HostBridge {
  const wa = () => maxWebApp();

  return {
    id: 'max',
    // Читаем каждый раз, а не запоминаем при создании: клиент может
    // дозаполнить объект уже после загрузки скрипта.
    get platform(): string | undefined {
      return wa()?.platform;
    },
    get capabilities(): HostCapabilities {
      const w = wa();
      return {
        haptics: !!w?.HapticFeedback && HAPTIC_PLATFORMS.has(w.platform ?? ''),
        backButton: !!w?.BackButton,
        // Своего значка на домашний экран у площадки нет.
        homeScreen: false,
        // Закрыть мини-апп изнутри нельзя — только предупреждение о закрытии.
        close: false,
      };
    },

    // MAX Bridge предзагружает данные сам — ready() ждать нечего.
    ready: () => {},
    // Управления разворотом вьюпорта у площадки нет.
    expand: () => {},
    // Метода закрыть себя изнутри у площадки нет — capabilities.close = false,
    // экран и так спрячет кнопку.
    close: () => {},

    user(): HostUser | null {
      const u = wa()?.initDataUnsafe?.user;
      if (!u) return null;
      return {
        id: String(u.id),
        firstName: u.first_name,
        // username может прийти null — в HostUser поле опционально,
        // null в строку не подставляем.
        username: u.username ?? undefined,
      };
    },
    startParam: () => wa()?.initDataUnsafe?.start_param ?? null,
    authHeaders: () => ({ 'x-max-init-data': wa()?.initData ?? '' }),
    sessionExchange() {
      const initData = wa()?.initData;
      return initData
        ? { path: '/api/auth/max/webapp', body: { initData } }
        : null;
    },

    // Своей темы площадка не навязывает — решает система.
    colorScheme: () => null,

    insets: (): HostInsets => ({
      contentTop: 0,
      deviceTop: 0,
      isFullscreen: false,
      // Инсетов MAX не присылает — чёлку и home-индикатор закрывает CSS
      // env(safe-area-inset-*), а не мост.
      contentReported: true,
    }),
    onInsetsChange: () => () => {},

    openLink: (url) => {
      if (isMaxDeepLink(url)) wa()?.openMaxLink?.(url);
      else wa()?.openLink?.(url);
    },
    // downloadFile требует https-ссылку, а нам приходит data:-URL (.ics файл
    // практики) — для неё отдаём обычную ссылку на скачивание, как в браузере.
    saveFile: (dataUrl, filename) => {
      if (/^https?:/i.test(dataUrl)) {
        wa()?.downloadFile?.(dataUrl, filename);
        return;
      }
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
    },

    haptic: {
      tap: () => wa()?.HapticFeedback?.impactOccurred('light'),
      press: () => wa()?.HapticFeedback?.impactOccurred('medium'),
      select: () => wa()?.HapticFeedback?.selectionChanged(),
      success: () => wa()?.HapticFeedback?.notificationOccurred('success'),
      warning: () => wa()?.HapticFeedback?.notificationOccurred('warning'),
      error: () => wa()?.HapticFeedback?.notificationOccurred('error'),
    },

    backButton: {
      setVisible(visible) {
        const bb = wa()?.BackButton;
        if (!bb) return;
        if (visible) bb.show();
        else bb.hide();
      },
      onClick(cb) {
        const bb = wa()?.BackButton;
        if (!bb) return () => {};
        bb.onClick(cb);
        return () => bb.offClick(cb);
      },
    },

    homeScreen: {
      add: () => {},
      checkStatus: (cb) => cb('unsupported'),
      onAdded: () => () => {},
    },
  };
}
