import { SessionType } from '@prisma/client';
import { SESSION_DEFAULT_PRICE } from './booking.config';
import { formatPrice } from './price-region';

// Цена сессии в статике визитки: JSON-LD webapp/index.html (оффер и ответ
// FAQPage) и webapp/public/llms.txt. В файлах — дефолт кода (сверка —
// staticCopies.sync.test.ts), при отдаче сервер ставит цену из админки:
// иначе правка в BookingSetting не доходит до поиска и нейросетей (№4).

/** Статика визитки с текущей ценой — PricingService.landingText. */
export type LandingText = (text: string) => Promise<string>;

/** Сколько живёт цена в памяти: инстансов несколько, свой кэш сбрасывает setPrice. */
export const LANDING_PRICE_TTL_MS = 60_000;

const DEFAULT_PRICE = SESSION_DEFAULT_PRICE[SessionType.SESSION_50];

/** «4 000 ₽» обычными пробелами — как в файлах статики. */
const rub = (price: number): string =>
  formatPrice(price, 'RUB').replace(/\s/g, ' ');

// Дефолт в тексте — с любым пробелом, но не хвост чужой суммы («14 000 ₽»);
// в JSON-LD — строкой, как в webapp/index.html.
const TEXT_PRICE = new RegExp(
  `(?<!\\d)${rub(DEFAULT_PRICE).replace(/ /g, '\\s')}`,
  'g',
);
const LD_PRICE = new RegExp(`("price":\\s*")${DEFAULT_PRICE}"`, 'g');

/** Текст статики с ценой `price` вместо дефолта кода. */
export function landingPriceText(text: string, price: number): string {
  return text
    .replace(LD_PRICE, (_m, head: string) => `${head}${price}"`)
    .replace(TEXT_PRICE, () => rub(price));
}

/**
 * Цена визитки с TTL. Промис кладётся сразу: параллельные запросы ждут одно
 * чтение. Сбой чтения — последняя известная цена (сначала дефолт) до конца
 * TTL, чтобы страница не ждала упавшую базу на каждом запросе.
 */
export class LandingPriceCache {
  private entry: { exp: number; val: Promise<number> } | null = null;
  private last = DEFAULT_PRICE;

  constructor(
    private readonly read: () => Promise<number>,
    private readonly onError: (err: unknown) => void,
  ) {}

  get(now = Date.now()): Promise<number> {
    if (!this.entry || now >= this.entry.exp) {
      const val = this.read().then(
        (price) => {
          this.last = price;
          return price;
        },
        (err: unknown) => {
          this.onError(err);
          return this.last;
        },
      );
      this.entry = { exp: now + LANDING_PRICE_TTL_MS, val };
    }
    return this.entry.val;
  }

  /** Цену сменили на этом инстансе — следующий запрос читает заново. */
  reset(): void {
    this.entry = null;
  }
}
