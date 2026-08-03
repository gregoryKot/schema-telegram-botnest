// @vitest-environment jsdom
// Мост до хоста: приложение открыто в Telegram, в MAX или в обычном браузере.
// Тест держит две вещи — что телеграмный адаптер зовёт ровно те же методы
// клиента, что и код до выноса (иначе миниапп тихо потеряет кнопку «назад»
// или инсеты), и что в браузере ни один вызов не падает без window.Telegram.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createTelegramHost } from './telegram';
import { createMaxHost, resetMaxLaunchParams } from './max';
import { createWebHost } from './web';
import { detectHostId, getHost, setHost } from './index';

type Listener = () => void;

function fakeTelegram(overrides: Record<string, unknown> = {}) {
  const events = new Map<string, Set<Listener>>();
  const webApp = {
    initData: 'user=%7B%22id%22%3A1%7D&hash=abc',
    initDataUnsafe: {
      start_param: 'invite_42',
      user: { id: 777, first_name: 'Гриша', username: 'grisha' },
    },
    contentSafeAreaInset: { top: 12 },
    safeAreaInset: { top: 47 },
    isFullscreen: true,
    platform: 'ios',
    colorScheme: 'dark' as const,
    ready: vi.fn(),
    expand: vi.fn(),
    close: vi.fn(),
    disableVerticalSwipes: vi.fn(),
    openLink: vi.fn(),
    addToHomeScreen: vi.fn(),
    checkHomeScreenStatus: vi.fn(),
    onEvent: vi.fn((e: string, cb: Listener) => {
      if (!events.has(e)) events.set(e, new Set());
      events.get(e)!.add(cb);
    }),
    offEvent: vi.fn((e: string, cb: Listener) => events.get(e)?.delete(cb)),
    BackButton: {
      show: vi.fn(),
      hide: vi.fn(),
      onClick: vi.fn(),
      offClick: vi.fn(),
    },
    HapticFeedback: {
      impactOccurred: vi.fn(),
      notificationOccurred: vi.fn(),
      selectionChanged: vi.fn(),
    },
    ...overrides,
  };
  (globalThis as { Telegram?: unknown }).Telegram = { WebApp: webApp };
  const emit = (e: string) => events.get(e)?.forEach((cb) => cb());
  return { webApp, emit };
}

function fakeMax(overrides: Record<string, unknown> = {}) {
  const clickHandlers = new Set<Listener>();
  const webApp = {
    initData: 'query_id=abc&hash=def',
    initDataUnsafe: {
      start_param: 'invite_42',
      user: { id: 777, first_name: 'Гриша', username: null },
    },
    platform: 'android',
    BackButton: {
      show: vi.fn(),
      hide: vi.fn(),
      onClick: vi.fn((cb: Listener) => clickHandlers.add(cb)),
      offClick: vi.fn((cb: Listener) => clickHandlers.delete(cb)),
    },
    HapticFeedback: {
      impactOccurred: vi.fn(),
      notificationOccurred: vi.fn(),
      selectionChanged: vi.fn(),
    },
    openLink: vi.fn(),
    openMaxLink: vi.fn(),
    downloadFile: vi.fn(),
    ...overrides,
  };
  (globalThis as { WebApp?: unknown }).WebApp = webApp;
  return { webApp };
}

function mockVibrate() {
  const vibrate = vi.fn();
  Object.defineProperty(navigator, 'vibrate', {
    value: vibrate,
    configurable: true,
  });
  return vibrate;
}

/** Приложение открыто с иконки (display-mode: standalone), а не вкладкой. */
function mockStandalone(on: boolean) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: on && query.includes('standalone'),
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
}

beforeEach(() => {
  setHost(null);
  delete (globalThis as { Telegram?: unknown }).Telegram;
  delete (globalThis as { WebApp?: unknown }).WebApp;
  Reflect.deleteProperty(navigator, 'vibrate');
  mockStandalone(false);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('определение хоста', () => {
  it('без window.Telegram — обычный браузер', () => {
    expect(detectHostId()).toBe('web');
    expect(getHost().id).toBe('web');
  });

  it('есть window.Telegram.WebApp — Telegram', () => {
    fakeTelegram();
    expect(detectHostId()).toBe('telegram');
    expect(getHost().id).toBe('telegram');
  });

  it('есть window.WebApp с признаками MAX Bridge — MAX', () => {
    fakeMax();
    expect(detectHostId()).toBe('max');
    expect(getHost().id).toBe('max');
  });

  it('оба объекта сразу — приоритет у Telegram', () => {
    fakeTelegram();
    fakeMax();
    expect(detectHostId()).toBe('telegram');
  });

  it('посторонний window.WebApp без признаков MAX Bridge — не хост MAX', () => {
    (globalThis as { WebApp?: unknown }).WebApp = { foo: 1 };
    expect(detectHostId()).toBe('web');
    (globalThis as { WebApp?: unknown }).WebApp = {};
    expect(detectHostId()).toBe('web');
  });
});

describe('адаптер Telegram', () => {
  it('пользователь и глубокая ссылка приходят из initDataUnsafe', () => {
    fakeTelegram();
    const host = createTelegramHost();
    expect(host.user()).toEqual({
      id: '777',
      firstName: 'Гриша',
      username: 'grisha',
    });
    expect(host.startParam()).toBe('invite_42');
  });

  it('первичный вход уходит заголовком initData', () => {
    fakeTelegram();
    expect(createTelegramHost().authHeaders()).toEqual({
      'x-telegram-init-data': 'user=%7B%22id%22%3A1%7D&hash=abc',
    });
  });

  it('свежая подпись меняется на сессию телеграмным эндпоинтом', () => {
    fakeTelegram();
    expect(createTelegramHost().sessionExchange()).toEqual({
      path: '/api/auth/telegram/webapp',
      body: { initData: 'user=%7B%22id%22%3A1%7D&hash=abc' },
    });
  });

  it('платформа перечитывается, а не запоминается при создании моста', () => {
    fakeTelegram({ platform: 'android' });
    const host = createTelegramHost();
    expect(host.platform).toBe('android');
    fakeTelegram({ platform: 'ios', addToHomeScreen: undefined });
    expect(host.platform).toBe('ios');
    expect(host.capabilities.homeScreen).toBe(false);
  });

  it('пустая initData не роняет заголовок', () => {
    fakeTelegram({ initData: undefined, initDataUnsafe: {} });
    const host = createTelegramHost();
    expect(host.authHeaders()).toEqual({ 'x-telegram-init-data': '' });
    expect(host.user()).toBeNull();
    expect(host.startParam()).toBeNull();
    // Обменивать нечего — сессию вытянет refresh-кука, а не пустая подпись.
    expect(host.sessionExchange()).toBeNull();
  });

  it('разворот гасит вертикальные свайпы — иначе жест в списке сворачивает всё', () => {
    const { webApp } = fakeTelegram();
    createTelegramHost().expand();
    expect(webApp.expand).toHaveBeenCalled();
    expect(webApp.disableVerticalSwipes).toHaveBeenCalled();
  });

  it('тактильный отклик разложен по типам клиента', () => {
    const { webApp } = fakeTelegram();
    const { haptic } = createTelegramHost();
    haptic.tap();
    haptic.select();
    haptic.success();
    expect(webApp.HapticFeedback.impactOccurred).toHaveBeenCalledWith('light');
    expect(webApp.HapticFeedback.selectionChanged).toHaveBeenCalled();
    expect(webApp.HapticFeedback.notificationOccurred).toHaveBeenCalledWith(
      'success',
    );
  });

  it('кнопка «назад»: показ, скрытие и отписка от клика', () => {
    const { webApp } = fakeTelegram();
    const host = createTelegramHost();
    host.backButton.setVisible(true);
    expect(webApp.BackButton.show).toHaveBeenCalled();
    host.backButton.setVisible(false);
    expect(webApp.BackButton.hide).toHaveBeenCalled();

    const cb = vi.fn();
    const off = host.backButton.onClick(cb);
    expect(webApp.BackButton.onClick).toHaveBeenCalledWith(cb);
    off();
    expect(webApp.BackButton.offClick).toHaveBeenCalledWith(cb);
  });

  it('contentReported взводится событием, а не значением инсета', () => {
    const { emit } = fakeTelegram();
    const host = createTelegramHost();
    expect(host.insets()).toEqual({
      contentTop: 12,
      deviceTop: 47,
      isFullscreen: true,
      contentReported: false,
    });

    const cb = vi.fn();
    host.onInsetsChange(cb);
    emit('contentSafeAreaChanged');
    expect(cb).toHaveBeenCalled();
    expect(host.insets().contentReported).toBe(true);
  });

  it('запоздавшие инсеты перечитываются по таймеру, отписка их снимает', () => {
    vi.useFakeTimers();
    fakeTelegram();
    const cb = vi.fn();
    const off = createTelegramHost().onInsetsChange(cb);
    vi.advanceTimersByTime(200);
    expect(cb).toHaveBeenCalledTimes(1);
    off();
    vi.advanceTimersByTime(1000);
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it('отписка снимает подписки на события клиента', () => {
    const { webApp } = fakeTelegram();
    const off = createTelegramHost().onInsetsChange(vi.fn());
    off();
    expect(webApp.offEvent).toHaveBeenCalledWith(
      'safeAreaChanged',
      expect.any(Function),
    );
    expect(webApp.offEvent).toHaveBeenCalledWith(
      'fullscreenChanged',
      expect.any(Function),
    );
  });

  it('значок на домашний экран: добавление, статус и подписка', () => {
    const { webApp, emit } = fakeTelegram();
    const host = createTelegramHost();
    expect(host.capabilities.homeScreen).toBe(true);
    host.homeScreen.add();
    expect(webApp.addToHomeScreen).toHaveBeenCalled();

    const added = vi.fn();
    const off = host.homeScreen.onAdded(added);
    emit('homeScreenAdded');
    expect(added).toHaveBeenCalled();
    off();
    emit('homeScreenAdded');
    expect(added).toHaveBeenCalledTimes(1);
  });

  it('старый клиент без новых методов не роняет вызовы', () => {
    fakeTelegram({
      HapticFeedback: undefined,
      BackButton: undefined,
      addToHomeScreen: undefined,
      disableVerticalSwipes: undefined,
    });
    const host = createTelegramHost();
    expect(host.capabilities).toEqual({
      haptics: false,
      backButton: false,
      homeScreen: false,
      close: true,
    });
    expect(() => {
      host.expand();
      host.haptic.tap();
      host.backButton.setVisible(true);
      host.homeScreen.add();
      host.backButton.onClick(vi.fn())();
    }).not.toThrow();
  });
});

describe('адаптер MAX', () => {
  it('пользователь и глубокая ссылка приходят из initDataUnsafe', () => {
    fakeMax();
    const host = createMaxHost();
    expect(host.user()).toEqual({
      id: '777',
      firstName: 'Гриша',
      username: undefined,
    });
    expect(host.startParam()).toBe('invite_42');
  });

  it('username: null не превращается в строку "null"', () => {
    fakeMax();
    const user = createMaxHost().user();
    expect(user?.username).toBeUndefined();
  });

  it('первичный вход уходит заголовком initData', () => {
    fakeMax();
    expect(createMaxHost().authHeaders()).toEqual({
      'x-max-init-data': 'query_id=abc&hash=def',
    });
  });

  it('свежая подпись меняется на сессию MAX-эндпоинтом', () => {
    fakeMax();
    expect(createMaxHost().sessionExchange()).toEqual({
      path: '/api/auth/max/webapp',
      body: { initData: 'query_id=abc&hash=def' },
    });
  });

  it('пустая initData не роняет заголовок и sessionExchange', () => {
    fakeMax({ initData: undefined, initDataUnsafe: {} });
    const host = createMaxHost();
    expect(host.authHeaders()).toEqual({ 'x-max-init-data': '' });
    expect(host.user()).toBeNull();
    expect(host.startParam()).toBeNull();
    expect(host.sessionExchange()).toBeNull();
  });

  it('хаптики доступны только на мобильных платформах', () => {
    fakeMax({ platform: 'android' });
    expect(createMaxHost().capabilities.haptics).toBe(true);

    fakeMax({ platform: 'desktop' });
    expect(createMaxHost().capabilities.haptics).toBe(false);

    fakeMax({ platform: 'web' });
    expect(createMaxHost().capabilities.haptics).toBe(false);
  });

  it('close и homeScreen у площадки нет, backButton есть', () => {
    fakeMax();
    const host = createMaxHost();
    expect(host.capabilities.close).toBe(false);
    expect(host.capabilities.homeScreen).toBe(false);
    expect(host.capabilities.backButton).toBe(true);
  });

  it('тактильный отклик разложен по типам клиента', () => {
    const { webApp } = fakeMax();
    const { haptic } = createMaxHost();
    haptic.tap();
    haptic.press();
    haptic.select();
    haptic.success();
    expect(webApp.HapticFeedback.impactOccurred).toHaveBeenNthCalledWith(
      1,
      'light',
    );
    expect(webApp.HapticFeedback.impactOccurred).toHaveBeenNthCalledWith(
      2,
      'medium',
    );
    expect(webApp.HapticFeedback.selectionChanged).toHaveBeenCalled();
    expect(webApp.HapticFeedback.notificationOccurred).toHaveBeenCalledWith(
      'success',
    );
  });

  it('кнопка «назад»: показ, скрытие и отписка от клика', () => {
    const { webApp } = fakeMax();
    const host = createMaxHost();
    host.backButton.setVisible(true);
    expect(webApp.BackButton.show).toHaveBeenCalled();
    host.backButton.setVisible(false);
    expect(webApp.BackButton.hide).toHaveBeenCalled();

    const cb = vi.fn();
    const off = host.backButton.onClick(cb);
    expect(webApp.BackButton.onClick).toHaveBeenCalledWith(cb);
    off();
    expect(webApp.BackButton.offClick).toHaveBeenCalledWith(cb);
  });

  it('диплинк max.ru открывается внутри мессенджера, остальные — во внешнем браузере', () => {
    const { webApp } = fakeMax();
    const host = createMaxHost();
    host.openLink('https://max.ru/invite/abc');
    expect(webApp.openMaxLink).toHaveBeenCalledWith(
      'https://max.ru/invite/abc',
    );
    host.openLink('https://schemehappens.ru/articles/1');
    expect(webApp.openLink).toHaveBeenCalledWith(
      'https://schemehappens.ru/articles/1',
    );
  });

  it('https-ссылка уходит в downloadFile, data:-URL — ссылкой на скачивание', () => {
    const { webApp } = fakeMax();
    createMaxHost().saveFile('https://schemehappens.ru/practice.ics', 'p.ics');
    expect(webApp.downloadFile).toHaveBeenCalledWith(
      'https://schemehappens.ru/practice.ics',
      'p.ics',
    );

    const anchor = document.createElement('a');
    const click = vi.spyOn(anchor, 'click').mockImplementation(() => {});
    vi.spyOn(document, 'createElement').mockReturnValue(anchor);
    createMaxHost().saveFile('data:text/calendar,BEGIN', 'practice.ics');
    expect(webApp.downloadFile).not.toHaveBeenCalledWith(
      'data:text/calendar,BEGIN',
      'practice.ics',
    );
    expect(anchor.getAttribute('href')).toBe('data:text/calendar,BEGIN');
    expect(click).toHaveBeenCalled();
  });

  it('инсеты MAX не присылает — отступ дальше считает CSS', () => {
    fakeMax();
    const host = createMaxHost();
    expect(host.insets()).toEqual({
      contentTop: 0,
      deviceTop: 0,
      isFullscreen: false,
      contentReported: true,
    });
    expect(host.onInsetsChange(vi.fn())).toBeInstanceOf(Function);
  });

  it('без window.WebApp ни один вызов не падает', () => {
    const host = createMaxHost();
    expect(() => {
      host.ready();
      host.expand();
      host.close();
      host.user();
      host.startParam();
      host.authHeaders();
      host.sessionExchange();
      host.colorScheme();
      host.insets();
      host.onInsetsChange(vi.fn())();
      host.openLink('https://max.ru/x');
      host.saveFile('data:text/calendar,BEGIN', 'p.ics');
      host.haptic.tap();
      host.haptic.press();
      host.haptic.select();
      host.haptic.success();
      host.haptic.warning();
      host.haptic.error();
      host.backButton.setVisible(true);
      host.backButton.onClick(vi.fn())();
      host.homeScreen.add();
      host.homeScreen.checkStatus(vi.fn());
      host.homeScreen.onAdded(vi.fn())();
    }).not.toThrow();
    expect(host.capabilities).toEqual({
      haptics: false,
      backButton: false,
      homeScreen: false,
      close: false,
    });
  });
});

describe('адаптер браузера', () => {
  it('чего в браузере нет — помечено в capabilities, а не притворяется', () => {
    const host = createWebHost();
    expect(host.capabilities.backButton).toBe(false);
    expect(host.capabilities.homeScreen).toBe(false);
    expect(host.capabilities.close).toBe(false);
  });

  it('пользователь неизвестен до входа, обменивать на сессию нечего', () => {
    const host = createWebHost();
    expect(host.user()).toBeNull();
    expect(host.authHeaders()).toEqual({});
    expect(host.sessionExchange()).toBeNull();
    expect(host.colorScheme()).toBeNull();
  });

  it('инсеты нулевые и отвеченные — отступ дальше считает CSS', () => {
    expect(createWebHost().insets()).toEqual({
      contentTop: 0,
      deviceTop: 0,
      isFullscreen: false,
      contentReported: true,
    });
  });

  it('глубокая ссылка читается из адреса страницы', () => {
    window.history.replaceState({}, '', '/app/?startapp=invite_42');
    expect(createWebHost().startParam()).toBe('invite_42');
    window.history.replaceState({}, '', '/app/');
    expect(createWebHost().startParam()).toBeNull();
  });

  it('в установленном приложении вибрация заменяет тактильный отклик', () => {
    const vibrate = mockVibrate();
    mockStandalone(true);
    const host = createWebHost();
    expect(host.capabilities.haptics).toBe(true);
    host.haptic.tap();
    host.haptic.press();
    expect(vibrate).toHaveBeenNthCalledWith(1, 10);
    expect(vibrate).toHaveBeenNthCalledWith(2, 20);
  });

  it('на сайте, открытом вкладкой, не вибрируем — это неожиданность, а не отклик', () => {
    const vibrate = mockVibrate();
    mockStandalone(false);
    const host = createWebHost();
    expect(host.capabilities.haptics).toBe(false);
    host.haptic.tap();
    expect(vibrate).not.toHaveBeenCalled();
  });

  it('файл отдаётся ссылкой на скачивание: data: в новой вкладке блокируется', () => {
    const anchor = document.createElement('a');
    const click = vi.spyOn(anchor, 'click').mockImplementation(() => {});
    vi.spyOn(document, 'createElement').mockReturnValue(anchor);

    createWebHost().saveFile('data:text/calendar,BEGIN', 'practice.ics');

    expect(anchor.getAttribute('href')).toBe('data:text/calendar,BEGIN');
    expect(anchor.getAttribute('download')).toBe('practice.ics');
    expect(click).toHaveBeenCalled();
    // Ссылка временная: после клика её в документе быть не должно.
    expect(document.body.contains(anchor)).toBe(false);
  });

  it('без вибрации вызовы тихие, статус значка — «не поддерживается»', () => {
    const host = createWebHost();
    expect(host.capabilities.haptics).toBe(false);
    expect(() => {
      host.ready();
      host.expand();
      host.close();
      host.haptic.error();
      host.backButton.setVisible(true);
      host.homeScreen.add();
      host.onInsetsChange(vi.fn())();
    }).not.toThrow();
    const status = vi.fn();
    host.homeScreen.checkStatus(status);
    expect(status).toHaveBeenCalledWith('unsupported');
  });
});

// ── Подпись из адреса ───────────────────────────────────────────────────────
// Живой iPhone в MAX показал, что стартовые параметры всегда лежат во
// фрагменте (#WebAppData=…). Значит вход не обязан зависеть от их CDN: не
// доедет скрипт моста — приложение иначе посчитало бы себя открытым в
// браузере и показало экран входа вместо автоматического.
describe('MAX: стартовые параметры из адреса', () => {
  function setHash(hash: string) {
    window.location.hash = hash;
    resetMaxLaunchParams();
  }

  afterEach(() => {
    setHash('');
  });

  it('без моста хост всё равно опознаётся как MAX', () => {
    setHash('#WebAppData=auth_date%3D1%26hash%3Dabc&WebAppPlatform=ios');
    expect(detectHostId()).toBe('max');
  });

  it('подпись для обмена берётся из адреса, когда моста нет', () => {
    setHash('#WebAppData=auth_date%3D1%26hash%3Dabc&WebAppPlatform=ios');
    const host = createMaxHost();
    expect(host.sessionExchange()).toEqual({
      path: '/api/auth/max/webapp',
      body: { initData: 'auth_date=1&hash=abc' },
    });
    expect(host.authHeaders()).toEqual({
      'x-max-init-data': 'auth_date=1&hash=abc',
    });
  });

  it('снимается ровно один слой кодирования — внутренние значения не тронуты', () => {
    // Во фрагменте значение закодировано ещё раз поверх внутреннего: бэкенд
    // ждёт строку, где значения остались процент-кодированными.
    setHash('#WebAppData=user%3D%257B%2522id%2522%253A7%257D%26hash%3Dabc');
    expect(createMaxHost().sessionExchange()?.body).toEqual({
      initData: 'user=%7B%22id%22%3A7%7D&hash=abc',
    });
  });

  it('буквальный + переживает разбор (URLSearchParams сделал бы из него пробел)', () => {
    setHash('#WebAppData=ip%3D1%2B2%26hash%3Dabc');
    expect(createMaxHost().sessionExchange()?.body).toEqual({
      initData: 'ip=1+2&hash=abc',
    });
  });

  it('мост, если доехал, важнее адреса', () => {
    setHash('#WebAppData=from%3Durl%26hash%3Dabc');
    fakeMax({ initData: 'from=bridge&hash=abc' });
    expect(createMaxHost().sessionExchange()?.body).toEqual({
      initData: 'from=bridge&hash=abc',
    });
  });

  it('платформа известна из адреса до загрузки моста', () => {
    setHash('#WebAppData=a%3Db&WebAppPlatform=ios');
    expect(createMaxHost().platform).toBe('ios');
    // Но хаптики без моста не обещаем: звать нечего.
    expect(createMaxHost().capabilities.haptics).toBe(false);
  });

  it('чужой фрагмент хостом MAX не считается', () => {
    setHash('#section=today');
    expect(detectHostId()).toBe('web');
  });
});
