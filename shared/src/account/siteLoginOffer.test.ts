// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import {
  isSiteLoginSnoozed,
  needsSiteLogin,
  SITE_LOGIN_SNOOZE_DAYS,
  snoozeSiteLogin,
} from './siteLoginOffer';

describe('needsSiteLogin — кому звать добавить почту, VK ID или Яндекс ID', () => {
  it.each([
    [['telegram'], 'telegram', true],
    // Уже есть чем войти на сайт — звать незачем.
    [['telegram', 'email'], 'telegram', false],
    [['telegram', 'vk'], 'telegram', false],
    [['telegram', 'yandex'], 'telegram', false],
    [['telegram', 'max'], 'telegram', false],
    // Не в Telegram: на сайте такой человек уже вошёл чем-то другим, в MAX — свой путь.
    [['telegram'], 'web', false],
    [['telegram'], 'max', false],
    // Ничего не знаем — не выдумываем.
    [[], 'telegram', false],
    [null, 'telegram', false],
  ] as const)('%j в %s → %s', (providers, hostId, expected) => {
    expect(
      needsSiteLogin({ providers: providers && [...providers], hostId }),
    ).toBe(expected);
  });
});

describe('«Позже» — на неделю', () => {
  beforeEach(() => localStorage.clear());

  it('сохранил → нашёл: отложено неделю, потом возвращается', () => {
    const now = Date.UTC(2026, 10, 12);
    expect(isSiteLoginSnoozed(now)).toBe(false);
    snoozeSiteLogin(now);
    expect(isSiteLoginSnoozed(now + 86_400_000)).toBe(true);
    expect(
      isSiteLoginSnoozed(now + SITE_LOGIN_SNOOZE_DAYS * 86_400_000 + 1),
    ).toBe(false);
  });

  it('мусор в хранилище — не отложено', () => {
    localStorage.setItem('site_login_offer', 'never');
    expect(isSiteLoginSnoozed()).toBe(false);
  });
});
