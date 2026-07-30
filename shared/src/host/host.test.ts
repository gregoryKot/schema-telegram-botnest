// @vitest-environment jsdom
// Мост до хоста: приложение открыто в Telegram, в MAX или в обычном браузере.
// Тест держит две вещи — что телеграмный адаптер зовёт ровно те же методы
// клиента, что и код до выноса (иначе миниапп тихо потеряет кнопку «назад»
// или инсеты), и что в браузере ни один вызов не падает без window.Telegram.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createTelegramHost } from './telegram';
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
