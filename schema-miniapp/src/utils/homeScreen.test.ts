// Предложение «добавить значок на экран»: где показываем и когда возвращаем.
// Матрица целиком под тестом — часть веток наступает только через неделю,
// вживую их не прощёлкать.
import { describe, it, expect, vi } from 'vitest';
import {
  ADD_ICON_HOP_URL,
  addToHomeScreenUrl,
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
  it('ссылка — ровно как у нативного клиента (startapp&addToHomeScreen)', () => {
    const url = addToHomeScreenUrl();
    expect(url).toMatch(/^https:\/\/t\.me\/.+\/.+\?startapp&addToHomeScreen$/);
  });

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
    (globalThis as never as { window: unknown }).window = {
      Telegram: { WebApp: { addToHomeScreen, openLink } },
    };

    triggerAddToHomeScreen('android');
    expect(addToHomeScreen).toHaveBeenCalledTimes(1);
    expect(openLink).not.toHaveBeenCalled();

    triggerAddToHomeScreen('ios');
    expect(openLink).toHaveBeenCalledWith(ADD_ICON_HOP_URL);
    expect(addToHomeScreen).toHaveBeenCalledTimes(1); // не вызвался второй раз

    delete (globalThis as never as { window?: unknown }).window;
  });
});
