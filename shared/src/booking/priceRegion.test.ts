import { describe, it, expect } from 'vitest';
import {
  CURRENCIES,
  CURRENCY_SYMBOL,
  REGION_CURRENCY,
  currencyFromTimeZone,
  formatPrice,
  isOnlinePaymentCurrency,
  isPlacelessTimeZone,
  regionFromTimeZone,
  resolvePriceCurrency,
} from './priceRegion';

describe('regionFromTimeZone — страна по часовому поясу', () => {
  it.each([
    ['Europe/Moscow', 'RU'],
    ['Europe/Kaliningrad', 'RU'],
    ['Asia/Yekaterinburg', 'RU'],
    ['Asia/Vladivostok', 'RU'],
    ['Asia/Jerusalem', 'IL'],
    ['Asia/Tel_Aviv', 'IL'],
    ['Europe/Berlin', 'EU'],
    ['Europe/Minsk', 'EU'],
    ['Atlantic/Canary', 'EU'],
    ['America/New_York', 'INTL'],
    ['Asia/Bangkok', 'INTL'],
    ['Australia/Sydney', 'INTL'],
    // Р5 (2026-11-08): пояс без места — «неизвестен», рубли.
    ['UTC', 'RU'],
    ['Etc/UTC', 'RU'],
    ['GMT', 'RU'],
    ['Etc/GMT', 'RU'],
    ['Etc/Universal', 'RU'],
    ['Etc/GMT-0', 'RU'],
    ['Zulu', 'RU'],
    ['Etc/GMT+10', 'INTL'],
    ['Etc/GMT-3', 'INTL'],
  ] as const)('%s → %s', (tz, region) => {
    expect(regionFromTimeZone(tz)).toBe(region);
  });

  it('пустой, отсутствующий и мусорный пояс — Россия (рубли, как у resolveClientTimeZone)', () => {
    expect(regionFromTimeZone(undefined)).toBe('RU');
    expect(regionFromTimeZone(null)).toBe('RU');
    expect(regionFromTimeZone('')).toBe('RU');
    expect(regionFromTimeZone('не пояс')).toBe('RU');
  });

  it('российский пояс не уходит в Азию, хотя лежит под префиксом Asia/', () => {
    expect(regionFromTimeZone('Asia/Novosibirsk')).toBe('RU');
    expect(regionFromTimeZone('Asia/Almaty')).toBe('INTL'); // контрольный: соседняя страна — не Россия
  });
});

describe('currencyFromTimeZone и REGION_CURRENCY', () => {
  it('валюта по поясу: рубли, шекели, евро, доллары', () => {
    expect(currencyFromTimeZone('Europe/Moscow')).toBe('RUB');
    expect(currencyFromTimeZone('Asia/Jerusalem')).toBe('ILS');
    expect(currencyFromTimeZone('Europe/Berlin')).toBe('EUR');
    expect(currencyFromTimeZone('America/New_York')).toBe('USD');
    expect(currencyFromTimeZone(undefined)).toBe('RUB');
  });

  it('у каждой валюты есть знак, и каждая валюта достижима из какого-то региона', () => {
    expect(Object.values(REGION_CURRENCY).sort()).toEqual(
      [...CURRENCIES].sort(),
    );
    for (const c of CURRENCIES) expect(CURRENCY_SYMBOL[c]).toBeTruthy();
  });
});

describe('isOnlinePaymentCurrency — Robokassa только в рублях', () => {
  it('рубли — да, остальное — нет', () => {
    expect(isOnlinePaymentCurrency('RUB')).toBe(true);
    expect(isOnlinePaymentCurrency('ILS')).toBe(false);
    expect(isOnlinePaymentCurrency('EUR')).toBe(false);
    expect(isOnlinePaymentCurrency('USD')).toBe(false);
  });
});

describe('formatPrice', () => {
  it('рубли — разряды по-русски, знак после суммы', () => {
    expect(formatPrice(4000, 'RUB')).toBe(
      (4000).toLocaleString('ru-RU') + ' ₽',
    );
  });

  it('шекели, евро, доллары', () => {
    expect(formatPrice(200, 'ILS')).toBe('200 ₪');
    expect(formatPrice(65, 'EUR')).toBe('65 €');
    expect(formatPrice(70, 'USD')).toBe('70 $');
  });

  it('ноль — «0 ₽» (карточка знакомства)', () => {
    expect(formatPrice(0, 'RUB')).toBe('0 ₽');
  });
});

// Решение владельца Р5: заграница при неизвестном поясе — по явному выбору
// валюты; при настоящем поясе выбор не действует (защита предоплаты).
describe('resolvePriceCurrency — явный выбор валюты', () => {
  it('пояс без места: выбор действует, без выбора — рубли', () => {
    expect(isPlacelessTimeZone('UTC')).toBe(true);
    expect(resolvePriceCurrency('UTC', 'EUR')).toBe('EUR');
    expect(resolvePriceCurrency('Etc/UTC', 'ILS')).toBe('ILS');
    expect(resolvePriceCurrency('UTC', null)).toBe('RUB');
  });

  it('настоящий или пустой пояс: выбор не действует', () => {
    expect(isPlacelessTimeZone('Europe/Moscow')).toBe(false);
    expect(isPlacelessTimeZone(undefined)).toBe(false);
    expect(resolvePriceCurrency('Europe/Moscow', 'EUR')).toBe('RUB');
    expect(resolvePriceCurrency('Asia/Bangkok', 'EUR')).toBe('USD');
    expect(resolvePriceCurrency(undefined, 'EUR')).toBe('RUB');
  });
});
