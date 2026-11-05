// @vitest-environment jsdom
// Предложение «установить приложение»: где показываем и когда возвращаем.
// Матрица целиком под тестом — часть веток наступает только через неделю,
// вживую их не прощёлкать.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import {
  buildHomeScreenHint,
  canOfferHomeScreen,
  canOfferHomeScreenNow,
  getOfferMemory,
  homeScreenPlatform,
  INSTALL_PAGE_PATH,
  installPageUrl,
  markHomeScreenNever,
  parseOfferMemory,
  resetHomeScreenOffer,
  shouldOfferHomeScreen,
  snoozeHomeScreen,
  SNOOZE_DAYS,
  type OfferMemory,
} from './homeScreen';
import { setHost } from './index';

const NOW = 1_800_000_000_000;
const DAY = 86_400_000;

const offer = (over: {
  hostId?: string;
  platform?: string;
  memory?: OfferMemory;
  now?: number;
}) =>
  shouldOfferHomeScreen({
    hostId: 'telegram',
    platform: 'ios',
    memory: { kind: 'fresh' },
    now: NOW,
    ...over,
  });

describe('canOfferHomeScreen', () => {
  it('Android и iOS внутри мессенджера — предлагаем', () => {
    expect(canOfferHomeScreen('telegram', 'android')).toBe(true);
    expect(canOfferHomeScreen('telegram', 'android_x')).toBe(true);
    expect(canOfferHomeScreen('telegram', 'ios')).toBe(true);
    expect(canOfferHomeScreen('max', 'android')).toBe(true);
  });

  it('десктоп и веб-клиенты — не предлагаем', () => {
    for (const p of ['macos', 'tdesktop', 'weba', 'webk', 'unknown']) {
      expect(canOfferHomeScreen('telegram', p)).toBe(false);
    }
  });

  it('в обычном браузере — не предлагаем (там своя страница установки)', () => {
    expect(canOfferHomeScreen('web', 'android')).toBe(false);
    expect(canOfferHomeScreen('web', 'ios')).toBe(false);
  });

  it('неизвестна платформа — не предлагаем', () => {
    expect(canOfferHomeScreen('telegram', undefined)).toBe(false);
  });

  it('платформа сводится к трём вариантам', () => {
    expect(homeScreenPlatform('android_x')).toBe('android');
    expect(homeScreenPlatform('ios')).toBe('ios');
    expect(homeScreenPlatform('tdesktop')).toBe('other');
    expect(homeScreenPlatform(undefined)).toBe('other');
  });
});

describe('canOfferHomeScreenNow', () => {
  afterEach(() => {
    delete (globalThis as { Telegram?: unknown }).Telegram;
    setHost(null);
  });

  it('берёт хост и платформу из getHost()', () => {
    expect(canOfferHomeScreenNow()).toBe(false);
    (globalThis as { Telegram?: unknown }).Telegram = {
      WebApp: { platform: 'ios', initData: 'query_id=1' },
    };
    setHost(null);
    expect(canOfferHomeScreenNow()).toBe(true);
  });
});

describe('installPageUrl', () => {
  it('без кода — чистый адрес страницы установки', () => {
    const url = installPageUrl();
    expect(url.endsWith(INSTALL_PAGE_PATH)).toBe(true);
    expect(url).not.toContain('#');
  });

  it('код уходит во фрагмент, не в query (не попадает в логи и Referer)', () => {
    const url = installPageUrl('a'.repeat(64));
    expect(url.endsWith(`${INSTALL_PAGE_PATH}#h=${'a'.repeat(64)}`)).toBe(true);
    expect(url).not.toContain('?');
  });

  it('без location берёт боевой домен', () => {
    const loc = globalThis.location;
    vi.stubGlobal('location', undefined);
    try {
      expect(installPageUrl()).toBe('https://schemehappens.ru/install');
    } finally {
      vi.unstubAllGlobals();
      expect(globalThis.location).toBe(loc);
    }
  });
});

describe('память предложения', () => {
  it('разбирает сырое значение, мусор считает пустым', () => {
    expect(parseOfferMemory(null)).toEqual({ kind: 'fresh' });
    expect(parseOfferMemory('added')).toEqual({ kind: 'added' });
    expect(parseOfferMemory('never')).toEqual({ kind: 'never' });
    expect(parseOfferMemory('12345')).toEqual({
      kind: 'snoozed',
      until: 12345,
    });
    expect(parseOfferMemory('чепуха')).toEqual({ kind: 'fresh' });
    expect(parseOfferMemory('-5')).toEqual({ kind: 'fresh' });
  });
});

describe('shouldOfferHomeScreen', () => {
  it('первый раз — предлагаем', () => {
    expect(offer({})).toBe(true);
  });

  it('отказался совсем — больше никогда', () => {
    expect(offer({ memory: { kind: 'never' } })).toBe(false);
    expect(offer({ memory: { kind: 'never' }, now: NOW + 365 * DAY })).toBe(
      false,
    );
  });

  it('«позже» — молчим неделю, потом предлагаем снова', () => {
    const memory: OfferMemory = {
      kind: 'snoozed',
      until: NOW + SNOOZE_DAYS * DAY,
    };
    expect(offer({ memory, now: NOW + DAY })).toBe(false);
    expect(offer({ memory, now: NOW + 6 * DAY })).toBe(false);
    expect(offer({ memory, now: NOW + SNOOZE_DAYS * DAY })).toBe(true);
    expect(offer({ memory, now: NOW + 10 * DAY })).toBe(true);
  });

  it('старая отметка «добавлено» (от ярлыка Telegram) — не предлагаем', () => {
    expect(offer({ memory: { kind: 'added' } })).toBe(false);
  });

  it('чужая платформа и обычный браузер — не предлагаем', () => {
    expect(offer({ platform: 'tdesktop' })).toBe(false);
    expect(offer({ hostId: 'web' })).toBe(false);
  });
});

describe('память предложения в localStorage', () => {
  beforeEach(() => localStorage.clear());

  it('пусто → fresh; «никогда» читается обратно', () => {
    expect(getOfferMemory()).toEqual({ kind: 'fresh' });
    markHomeScreenNever();
    expect(getOfferMemory()).toEqual({ kind: 'never' });
  });

  it('«позже» хранит срок на неделю вперёд от переданного момента', () => {
    const now = 1_700_000_000_000;
    snoozeHomeScreen(now);
    const m = getOfferMemory();
    expect(m.kind).toBe('snoozed');
    if (m.kind === 'snoozed')
      expect(m.until).toBe(now + 7 * 24 * 60 * 60 * 1000);
  });

  it('сброс из настроек возвращает fresh даже после «никогда»', () => {
    markHomeScreenNever();
    resetHomeScreenOffer();
    expect(getOfferMemory()).toEqual({ kind: 'fresh' });
  });

  it('приватный режим (localStorage бросает) — читается как fresh, запись и сброс не падают', () => {
    const proto = Object.getPrototypeOf(localStorage) as Storage;
    const boom = () => {
      throw new Error('QuotaExceeded');
    };
    const g = vi.spyOn(proto, 'getItem').mockImplementation(boom);
    const s = vi.spyOn(proto, 'setItem').mockImplementation(boom);
    const r = vi.spyOn(proto, 'removeItem').mockImplementation(boom);
    try {
      expect(getOfferMemory()).toEqual({ kind: 'fresh' });
      expect(() => markHomeScreenNever()).not.toThrow();
      expect(() => snoozeHomeScreen()).not.toThrow();
      expect(() => resetHomeScreenOffer()).not.toThrow();
    } finally {
      g.mockRestore();
      s.mockRestore();
      r.mockRestore();
    }
  });
});

describe('buildHomeScreenHint', () => {
  it('iOS — Safari и «Поделиться» → «На экран „Домой“»', () => {
    const hint = buildHomeScreenHint('ios');
    expect(hint).toContain('Safari');
    expect(hint).toContain('На экран „Домой“');
  });
  it('Android — кнопка «Установить приложение» в браузере', () => {
    expect(buildHomeScreenHint('android')).toContain('Установить приложение');
  });
});
