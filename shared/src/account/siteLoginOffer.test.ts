// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import {
  isSiteLoginSnoozed,
  needsSiteLogin,
  SITE_LOGIN_SNOOZE_DAYS,
  snoozeSiteLogin,
} from './siteLoginOffer';

describe('needsSiteLogin — кому звать добавить VK ID или Яндекс ID', () => {
  it.each([
    [['telegram'], 'telegram', true],
    // Почта на сайт больше не впускает (решение владельца, ч. 10 ст. 8 149-ФЗ).
    [['telegram', 'email'], 'telegram', true],
    [['email'], 'web', true],
    [['google', 'email'], 'web', true],
    [['telegram', 'email'], 'web', true],
    // Уже есть чем попасть на сайт — звать незачем.
    [['telegram', 'vk'], 'telegram', false],
    [['telegram', 'yandex'], 'telegram', false],
    [['telegram', 'max'], 'telegram', false],
    [['email', 'vk'], 'web', false],
    [['max'], 'web', false],
    // В MAX — свой путь: сессию передают в браузер.
    [['telegram'], 'max', false],
    [['email'], 'max', false],
    // Ничего не знаем — не выдумываем.
    [[], 'telegram', false],
    [null, 'telegram', false],
    [[], 'web', false],
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
