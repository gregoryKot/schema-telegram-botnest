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

// ── Стартовые параметры из адреса ────────────────────────────────────────────
//
// MAX кладёт их во фрагмент: `#WebAppData=…&WebAppPlatform=ios&WebAppVersion=…`
// (плюс WebAppDeviceName — его в примере документации нет, но на живом
// устройстве он приезжает). Мост читает подпись оттуда же, поэтому вход не
// обязан ждать их CDN: скрипт не доехал или заблокирован — подпись всё равно
// у нас в руках, а мост нужен лишь для необязательного (кнопка «назад»,
// хаптики), и его отсутствие честно отражается в capabilities.
//
// Читаем ОДИН раз и запоминаем: приложение потом работает с историей
// (useHostBackButton), и полагаться на неизменность адреса нельзя. Лениво, а
// не при загрузке модуля, — иначе значение зависело бы от порядка импортов и
// его нельзя было бы проверить тестом.
let cached: Record<string, string> | null = null;

function launchParams(): Record<string, string> {
  cached ??= readLaunchParams();
  return cached;
}

/** Только для тестов: перечитать адрес заново. */
export function resetMaxLaunchParams(): void {
  cached = null;
}

function readLaunchParams(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  const raw = window.location.hash.replace(/^#/, '');
  if (!raw) return {};
  const out: Record<string, string> = {};
  // Вручную, а НЕ URLSearchParams: тот превращает буквальный `+` в пробел, и
  // подпись перестала бы сходиться. Их собственный пример валидации снимает
  // ровно один слой decodeURIComponent — делаем так же.
  for (const pair of raw.split('&')) {
    const eq = pair.indexOf('=');
    if (eq <= 0) continue;
    const key = pair.slice(0, eq);
    try {
      out[key] = decodeURIComponent(pair.slice(eq + 1));
    } catch {
      /* битое кодирование — параметр просто пропускаем */
    }
  }
  return out;
}

/** Подпись запуска: сначала мост, если он доехал, иначе — адрес страницы. */
function launchInitData(): string {
  return maxWebApp()?.initData || launchParams()['WebAppData'] || '';
}

/** Признак «нас открыл MAX» — виден до загрузки моста и без него. */
export function hasMaxLaunchParams(): boolean {
  return !!launchParams()['WebAppData'];
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
    // Мост знает платформу точнее, но её же присылают в адресе — значит
    // ответ есть и до его загрузки.
    get platform(): string | undefined {
      return wa()?.platform ?? launchParams()['WebAppPlatform'];
    },
    get capabilities(): HostCapabilities {
      const w = wa();
      return {
        // Без моста хаптик нет физически — звать нечего, сколько бы
        // подходящей ни была платформа.
        haptics:
          !!w?.HapticFeedback &&
          HAPTIC_PLATFORMS.has(
            w.platform ?? launchParams()['WebAppPlatform'] ?? '',
          ),
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
    authHeaders: () => ({ 'x-max-init-data': launchInitData() }),
    sessionExchange() {
      const initData = launchInitData();
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
      overlaysContent: false,
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
