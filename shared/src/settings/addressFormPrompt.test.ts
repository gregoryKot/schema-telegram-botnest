// @vitest-environment jsdom
// Регресс 2026-08-21 («двадцать раз прошёл онбординг»): отметка «уже
// спрашивали форму обращения» жила в sessionStorage, то есть ровно одну
// вкладку — вопрос возвращался при каждом открытии. Теперь localStorage
// со снузом на неделю, а выбранная форма с сервера закрывает вопрос совсем.
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  ADDRESS_FORM_ASKED_KEY,
  ASK_AGAIN_AFTER_DAYS,
  isAskSnoozed,
  shouldAskAddressForm,
  markAddressFormAsked,
} from './addressFormPrompt';

const DAY = 86_400_000;
const NOW = 1_700_000_000_000;

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('shouldAskAddressForm', () => {
  it('форма выбрана на сервере — не спрашиваем, даже без локальной отметки', () => {
    expect(shouldAskAddressForm('vy', NOW)).toBe(false);
    expect(shouldAskAddressForm('ty', NOW)).toBe(false);
  });

  it('форма не выбрана и не спрашивали — спрашиваем', () => {
    expect(shouldAskAddressForm(null, NOW)).toBe(true);
  });

  it('нажали «Позже» — молчим неделю, потом спрашиваем снова', () => {
    markAddressFormAsked(NOW);
    expect(shouldAskAddressForm(null, NOW)).toBe(false);
    expect(shouldAskAddressForm(null, NOW + 6 * DAY)).toBe(false);
    expect(
      shouldAskAddressForm(null, NOW + (ASK_AGAIN_AFTER_DAYS + 1) * DAY),
    ).toBe(true);
  });

  it('отметка переживает перезагрузку страницы (localStorage, а не sessionStorage)', () => {
    markAddressFormAsked(NOW);
    expect(localStorage.getItem(ADDRESS_FORM_ASKED_KEY)).toBe(String(NOW));
    expect(sessionStorage.getItem(ADDRESS_FORM_ASKED_KEY)).toBeNull();
  });

  it('localStorage недоступен (приватный режим) — спрашиваем, не падаем', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('denied');
      },
      setItem: () => {
        throw new Error('denied');
      },
    });
    expect(shouldAskAddressForm(null, NOW)).toBe(true);
    expect(() => markAddressFormAsked(NOW)).not.toThrow();
  });
});

describe('isAskSnoozed — разбор сырого значения', () => {
  it('пусто и мусор считаются «не спрашивали»', () => {
    expect(isAskSnoozed(null, NOW)).toBe(false);
    expect(isAskSnoozed('', NOW)).toBe(false);
    // '1' — формат старой sessionStorage-отметки: не время, снуз не считается
    expect(isAskSnoozed('1', NOW)).toBe(false);
    expect(isAskSnoozed('какая-то строка', NOW)).toBe(false);
  });

  it('свежая метка — снуз активен, старая — истёк', () => {
    expect(isAskSnoozed(String(NOW), NOW + DAY)).toBe(true);
    expect(isAskSnoozed(String(NOW), NOW + 30 * DAY)).toBe(false);
  });
});
