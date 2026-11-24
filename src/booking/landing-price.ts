import { SessionType } from '@prisma/client';
import { DEFAULT_PRICE } from './price-currency';
import { CURRENCIES, Currency, formatPrice } from './price-region';

// Цена сессии в статике визитки: JSON-LD webapp/index.html (офферы и ответ
// FAQPage) и webapp/public/llms.txt. В файлах — дефолты кода по валютам
// (сверка — staticCopies.sync.test.ts), при отдаче сервер ставит цены из
// админки: иначе правка в BookingSetting не доходит до поиска и нейросетей (№4).
// Валюта без цены в статике не показывается: курс никто не считает.

/** Статика визитки с текущими ценами — PricingService.landingText. */
export type LandingText = (text: string) => Promise<string>;

/** Цена сессии по валютам; нет ключа — валюту не показываем. */
export type LandingPrices = Partial<Record<Currency, number>>;

export const DEFAULTS: Record<Currency, number> = {
  RUB: DEFAULT_PRICE.RUB[SessionType.SESSION_50],
  ILS: DEFAULT_PRICE.ILS[SessionType.SESSION_50],
  EUR: DEFAULT_PRICE.EUR[SessionType.SESSION_50],
  USD: DEFAULT_PRICE.USD[SessionType.SESSION_50],
};

/** «4 000 ₽» обычными пробелами — как в файлах статики. */
const money = (price: number, c: Currency): string =>
  formatPrice(price, c).replace(/\s/g, ' ');

const usable = (p: number | undefined): p is number =>
  typeof p === 'number' && Number.isFinite(p) && p > 0;

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const spaced = (s: string) => esc(s).replace(/ /g, '\\s');

// Текст: рубли дефолта (не хвост чужой суммы «14 000 ₽») и за ними «/ 200 ₪ …».
const TEXT_PRICES = new RegExp(
  `(?<!\\d)${spaced(money(DEFAULTS.RUB, 'RUB'))}(?:\\s/\\s\\d[\\d\\s]*\\s[₪€$])*`,
  'g',
);
// JSON-LD: оффер валюты с дефолтной ценой; в нём нет вложенных объектов.
const ldOffer = (c: Currency) =>
  new RegExp(
    `(,\\s*)?(\\{[^{}]*"price":\\s*")${DEFAULTS[c]}("[^{}]*"priceCurrency":\\s*"${c}"[^{}]*\\})`,
    'g',
  );

/** Текст статики с ценами `prices` вместо дефолтов кода. */
export function landingPriceText(text: string, prices: LandingPrices): string {
  const shown = CURRENCIES.filter((c) => usable(prices[c]));
  let out = text;
  // Рубли — как были: оффер может быть и без priceCurrency рядом (фикстуры).
  out = out.replace(
    new RegExp(`("price":\\s*")${DEFAULTS.RUB}"`, 'g'),
    (m, head: string) => (usable(prices.RUB) ? `${head}${prices.RUB}"` : m),
  );
  for (const c of CURRENCIES.filter((x) => x !== 'RUB')) {
    const price = prices[c];
    out = out.replace(
      ldOffer(c),
      (_m, comma = '', head: string, tail: string) =>
        usable(price) ? `${comma}${head}${price}${tail}` : '',
    );
  }
  // «/ 200 ₪ …» в файле — место валют; голые рубли (FAQ) остаются рублями.
  return out.replace(TEXT_PRICES, (m) => {
    const list = m.includes('/') ? shown : shown.filter((c) => c === 'RUB');
    return list.length
      ? list.map((c) => money(prices[c] as number, c)).join(' / ')
      : m;
  });
}
