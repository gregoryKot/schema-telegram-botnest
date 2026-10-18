// @vitest-environment jsdom
// Предложение «добавить значок на экран»: где показываем и когда возвращаем.
// Матрица целиком под тестом — часть веток наступает только через неделю,
// вживую их не прощёлкать.
import { describe, it, expect, vi, beforeEach } from 'vitest';

import {
  ADD_ICON_HOP_URL,
  canOfferHomeScreen,
  homeScreenButtonWorks,
  triggerAddToHomeScreen,
  homeScreenPlatform,
  parseOfferMemory,
  shouldOfferHomeScreen,
  SNOOZE_DAYS,
  type OfferMemory,
} from './homeScreen';

const NOW = 1_800_000_000_000;
const DAY = 86_400_000;

const offer = (over: {
  platform?: string;
  hasApi?: boolean;
  tgStatus?: 'unsupported' | 'unknown' | 'added' | 'missed';
  memory?: OfferMemory;
  now?: number;
}) =>
  shouldOfferHomeScreen({
    platform: 'ios',
    hasApi: true,
    memory: { kind: 'fresh' },
    now: NOW,
    ...over,
  });

describe('canOfferHomeScreen', () => {
  it('Android и iOS — предлагаем', () => {
    expect(canOfferHomeScreen('android', true)).toBe(true);
    expect(canOfferHomeScreen('android_x', true)).toBe(true);
    // На iOS нативная картинка Telegram врёт, но механизм рабочий — поэтому
    // предлагаем со своей подводкой, а не прячем возможность.
    expect(canOfferHomeScreen('ios', true)).toBe(true);
  });

  it('десктоп и веб-клиенты — не предлагаем', () => {
    for (const p of ['macos', 'tdesktop', 'weba', 'webk', 'unknown']) {
      expect(canOfferHomeScreen(p, true)).toBe(false);
    }
  });

  it('нет API (старый клиент) или неизвестна платформа — не предлагаем', () => {
    expect(canOfferHomeScreen('android', false)).toBe(false);
    expect(canOfferHomeScreen(undefined, true)).toBe(false);
  });

  it('платформа сводится к трём вариантам', () => {
    expect(homeScreenPlatform('android_x')).toBe('android');
    expect(homeScreenPlatform('ios')).toBe('ios');
    expect(homeScreenPlatform('tdesktop')).toBe('other');
    expect(homeScreenPlatform(undefined)).toBe('other');
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

  it('значок уже стоит — не предлагаем (слово Telegram важнее памяти)', () => {
    expect(offer({ tgStatus: 'added' })).toBe(false);
    expect(offer({ memory: { kind: 'added' } })).toBe(false);
  });

  it('отметка «добавлено» устарела — значка нет, предлагаем снова', () => {
    expect(offer({ memory: { kind: 'added' }, tgStatus: 'missed' })).toBe(true);
  });

  it('чужая платформа — не предлагаем, что бы ни было в памяти', () => {
    expect(offer({ platform: 'tdesktop' })).toBe(false);
    expect(offer({ platform: 'tdesktop', tgStatus: 'missed' })).toBe(false);
    expect(offer({ hasApi: false })).toBe(false);
  });
});

// Регресс «кнопка не работает» (21.07.2026): нативный addToHomeScreen на новых
// iOS открывает ссылку приватной схемой x-safari-https и молча умирает
// (WebAppController.swift). Кнопка обязана вести на ту же t.me-страницу через
// openLink — и матрица платформ зафиксирована тестом.
describe('triggerAddToHomeScreen', () => {
  it('кнопка есть на обеих мобильных платформах, но не на десктопе', () => {
    expect(homeScreenButtonWorks('android')).toBe(true);
    expect(homeScreenButtonWorks('ios')).toBe(true);
    expect(homeScreenButtonWorks('other')).toBe(false);
  });

  it('прыжковая ссылка — наш домен (t.me напрямую = universal link, умирает)', () => {
    expect(ADD_ICON_HOP_URL).toMatch(/^https:\/\/schemehappens\.ru\//);
    expect(ADD_ICON_HOP_URL).not.toContain('t.me');
  });

  it('Android — нативный вызов; iOS — openLink прыжковой страницей', () => {
    const addToHomeScreen = vi.fn();
    const openLink = vi.fn();
    // platform обязателен: вне мессенджера их SDK оставляет 'unknown', и
    // детект хоста такой объект настоящим Telegram не считает (инцидент
    // 2026-08-03, shared/src/host/telegram.ts).
    (globalThis as never as { Telegram: unknown }).Telegram = {
      WebApp: { platform: 'android', addToHomeScreen, openLink },
    };

    triggerAddToHomeScreen('android');
    expect(addToHomeScreen).toHaveBeenCalledTimes(1);
    expect(openLink).not.toHaveBeenCalled();

    triggerAddToHomeScreen('ios');
    expect(openLink).toHaveBeenCalledWith(ADD_ICON_HOP_URL);
    expect(addToHomeScreen).toHaveBeenCalledTimes(1); // не вызвался второй раз

    delete (globalThis as never as { Telegram?: unknown }).Telegram;
  });
});

// ── Память в localStorage: чтение, запись, снуз, сброс, приватный режим ──────
import {
  getOfferMemory,
  markHomeScreenAdded,
  markHomeScreenNever,
  snoozeHomeScreen,
  resetHomeScreenOffer,
  buildHomeScreenHint,
} from './homeScreen';

describe('память предложения в localStorage', () => {
  beforeEach(() => localStorage.clear());

  it('пусто → fresh; «добавил» и «никогда» читаются обратно', () => {
    expect(getOfferMemory()).toEqual({ kind: 'fresh' });
    markHomeScreenAdded();
    expect(getOfferMemory()).toEqual({ kind: 'added' });
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
      expect(() => markHomeScreenAdded()).not.toThrow();
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
  const tr = (ty: string, vy: string) => `${ty}|${vy}`;
  it('iOS — про страницу в браузере и запасной путь через «⋯»', () => {
    const hint = buildHomeScreenHint('ios', tr);
    expect(hint).toContain('Откроется страница в браузере');
    expect(hint).toContain('следуй инструкции');
    expect(hint).toContain('следуйте инструкции');
  });
  it('Android — про подтверждение Telegram, в обеих формах', () => {
    const hint = buildHomeScreenHint('android', tr);
    expect(hint).toContain('согласись');
    expect(hint).toContain('согласитесь');
  });
});
