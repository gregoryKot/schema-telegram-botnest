// Регрессия на инцидент iOS: «прошёл онбординг → зашёл с ярлыка на домашнем
// экране → онбординг заново» (см. шапку onboardingState.ts).
// Тест read-after-write: пометили шаг пройденным → он не показывается снова,
// в том числе при перезаходе с чистым localStorage (серверный флаг).
import { describe, it, expect, beforeEach } from 'vitest';
import {
  DISCLAIMER_KEY,
  ONBOARDING_SEEN_KEY,
  isOnboardingSeenLocally,
  isDisclaimerAcceptedLocally,
  markOnboardingSeenLocally,
  markDisclaimerAcceptedLocally,
  shouldShowOnboarding,
} from './onboardingState';
import { createLocalStorageMock } from './localStorageMock';

beforeEach(() => {
  (globalThis as { localStorage: unknown }).localStorage =
    createLocalStorageMock();
});

describe('локальные флаги онбординга', () => {
  it('на чистом устройстве оба флага пусты', () => {
    expect(isOnboardingSeenLocally()).toBe(false);
    expect(isDisclaimerAcceptedLocally()).toBe(false);
  });

  it('сохранил → прочитал (read-after-write), флаги независимы', () => {
    markDisclaimerAcceptedLocally();
    expect(isDisclaimerAcceptedLocally()).toBe(true);
    expect(isOnboardingSeenLocally()).toBe(false);

    markOnboardingSeenLocally();
    expect(isOnboardingSeenLocally()).toBe(true);
    expect(localStorage.getItem(ONBOARDING_SEEN_KEY)).toBe('1');
    expect(localStorage.getItem(DISCLAIMER_KEY)).toBe('1');
  });

  it('не падает без localStorage (приватный режим)', () => {
    (globalThis as { localStorage: unknown }).localStorage = {
      getItem: () => {
        throw new Error('denied');
      },
      setItem: () => {
        throw new Error('denied');
      },
    };
    expect(isOnboardingSeenLocally()).toBe(false);
    expect(() => markOnboardingSeenLocally()).not.toThrow();
  });
});

describe('shouldShowOnboarding', () => {
  const base = {
    seenLocally: false,
    serverDone: false,
    flagsLoaded: true,
    addressFormReady: true,
  };

  it('новичку — показываем', () => {
    expect(shouldShowOnboarding(base)).toBe(true);
  });

  it('пока форма обращения не выбрана — не показываем', () => {
    expect(shouldShowOnboarding({ ...base, addressFormReady: false })).toBe(
      false,
    );
  });

  it('пока серверные флаги не загрузились — не показываем', () => {
    expect(shouldShowOnboarding({ ...base, flagsLoaded: false })).toBe(false);
  });

  it('прошёл на этом устройстве — не показываем', () => {
    expect(shouldShowOnboarding({ ...base, seenLocally: true })).toBe(false);
  });

  // Ядро инцидента: ярлык на домашнем экране открывается в отдельном хранилище,
  // localStorage там пуст. Показ обязан закрываться серверным флагом.
  it('перезаход с чистым localStorage, но серверный флаг стоит — не показываем', () => {
    expect(
      shouldShowOnboarding({ ...base, seenLocally: false, serverDone: true }),
    ).toBe(false);
  });

  it('серверный флаг стоит, флаги ещё грузятся — всё равно не показываем', () => {
    expect(
      shouldShowOnboarding({
        ...base,
        seenLocally: false,
        serverDone: true,
        flagsLoaded: false,
      }),
    ).toBe(false);
  });
});
