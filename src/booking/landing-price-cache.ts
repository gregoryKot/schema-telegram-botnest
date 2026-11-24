import { DEFAULTS, LandingPrices, landingPriceText } from './landing-price';

/** Сколько живёт цена в памяти: инстансов несколько, свой кэш сбрасывает setPrice. */
export const LANDING_PRICE_TTL_MS = 60_000;

/**
 * Цена визитки с TTL. Промис кладётся сразу: параллельные запросы ждут одно
 * чтение. Сбой чтения — последняя известная цена (сначала дефолт) до конца
 * TTL, чтобы страница не ждала упавшую базу на каждом запросе.
 */
export class LandingPriceCache {
  private entry: { exp: number; val: Promise<LandingPrices> } | null = null;
  private last: LandingPrices = DEFAULTS;

  constructor(
    private readonly read: () => Promise<LandingPrices>,
    private readonly onError: (err: unknown) => void,
  ) {}

  get(now = Date.now()): Promise<LandingPrices> {
    if (!this.entry || now >= this.entry.exp) {
      const val = this.read().then(
        (prices) => {
          this.last = prices;
          return prices;
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

  /** Текст статики с текущими ценами. */
  async apply(text: string): Promise<string> {
    return landingPriceText(text, await this.get());
  }

  /** Цену сменили на этом инстансе — следующий запрос читает заново. */
  reset(): void {
    this.entry = null;
  }
}
