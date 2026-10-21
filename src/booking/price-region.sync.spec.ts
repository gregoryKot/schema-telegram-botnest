// Сверка бэкендовой копии региона цены со shared/src/booking/priceRegion.ts
// (правило №4 CLAUDE.md; бэкенд не импортирует shared/, см. client-timezone.ts)
// и контрольные значения самих функций. Сверка — по тексту от `export type
// PriceRegion` до конца файла, побайтно: строже и проще парсинга литералов,
// а шапка (комментарий про копию) у файлов своя.
import { readFileSync } from 'fs';
import { join } from 'path';
import {
  CURRENCIES,
  CURRENCY_SYMBOL,
  REGION_CURRENCY,
  currencyFromTimeZone,
  formatPrice,
  isOnlinePaymentCurrency,
  regionFromTimeZone,
} from './price-region';

const SHARED = join(
  __dirname,
  '..',
  '..',
  'shared',
  'src',
  'booking',
  'priceRegion.ts',
);
const BACKEND = join(__dirname, 'price-region.ts');
const START = 'export type PriceRegion';

/** Текст файла от объявления PriceRegion до конца. */
function body(path: string): string {
  const src = readFileSync(path, 'utf8');
  const at = src.indexOf(START);
  if (at < 0) throw new Error(`Не нашёл «${START}» в ${path}`);
  return src.slice(at);
}

describe('price-region ↔ shared/src/booking/priceRegion', () => {
  it('текст от `export type PriceRegion` до конца совпадает побайтно', () => {
    expect(body(BACKEND)).toBe(body(SHARED));
  });
});

describe('regionFromTimeZone', () => {
  it.each([
    ['Europe/Moscow', 'RU'],
    ['Asia/Yekaterinburg', 'RU'],
    ['Asia/Vladivostok', 'RU'],
    ['Europe/Kaliningrad', 'RU'],
    ['Asia/Jerusalem', 'IL'],
    ['Asia/Tel_Aviv', 'IL'],
    ['Europe/Berlin', 'EU'],
    ['Europe/Minsk', 'EU'],
    ['Atlantic/Canary', 'EU'],
    ['America/New_York', 'INTL'],
    ['Asia/Bangkok', 'INTL'],
    ['Australia/Sydney', 'INTL'],
    ['UTC', 'INTL'],
  ])('%s → %s', (tz, region) => {
    expect(regionFromTimeZone(tz)).toBe(region);
  });

  it.each([undefined, null, '', 'мусор', 'Not/AZone', 'moscow'])(
    'пусто или не похоже на пояс (%p) → RU: рубли и онлайн-оплата, как до введения регионов',
    (tz) => {
      expect(regionFromTimeZone(tz as string | null | undefined)).toBe('RU');
    },
  );

  it('Израиль не попадает в «остальную Азию», а Москва — в «остальную Европу»', () => {
    expect(regionFromTimeZone('Asia/Jerusalem')).not.toBe('INTL');
    expect(regionFromTimeZone('Europe/Moscow')).not.toBe('EU');
  });
});

describe('currencyFromTimeZone / isOnlinePaymentCurrency', () => {
  it.each([
    ['Europe/Moscow', 'RUB'],
    ['Asia/Jerusalem', 'ILS'],
    ['Europe/Paris', 'EUR'],
    ['Asia/Dubai', 'USD'],
    [undefined, 'RUB'],
  ])('%s → %s', (tz, currency) => {
    expect(currencyFromTimeZone(tz)).toBe(currency);
  });

  it('онлайн-оплата только в рублях', () => {
    expect(CURRENCIES.filter(isOnlinePaymentCurrency)).toEqual(['RUB']);
  });

  it('у каждого региона есть валюта из списка, у каждой валюты — знак', () => {
    for (const c of Object.values(REGION_CURRENCY)) {
      expect(CURRENCIES).toContain(c);
    }
    for (const c of CURRENCIES) expect(CURRENCY_SYMBOL[c]).toBeTruthy();
  });
});

describe('formatPrice', () => {
  it('рубли: разряды по-русски, знак после суммы', () => {
    expect(formatPrice(4000, 'RUB')).toBe(
      `${(4000).toLocaleString('ru-RU')} ₽`,
    );
    expect(formatPrice(4000, 'RUB').endsWith(' ₽')).toBe(true);
  });

  it('прочие валюты', () => {
    expect(formatPrice(70, 'USD')).toBe('70 $');
    expect(formatPrice(65, 'EUR')).toBe('65 €');
    expect(formatPrice(200, 'ILS')).toBe('200 ₪');
  });
});
