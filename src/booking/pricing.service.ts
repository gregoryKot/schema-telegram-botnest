import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SESSION_META } from './booking.config';
import { SessionType } from '@prisma/client';
import { validPrice } from './price-rules';
import { Currency } from './price-region';
import { priceKey, priceOrDefault, pricesByCurrency } from './price-currency';

/** Session prices, editable in the admin panel (BookingSetting), with config defaults. */
@Injectable()
export class PricingService {
  constructor(private readonly prisma: PrismaService) {}

  /** Price in a currency — DB override if set, else the default (rubles when omitted). */
  async getPrice(type: SessionType, currency: Currency = 'RUB') {
    const key = priceKey(type, currency);
    const row = await this.prisma.bookingSetting.findUnique({ where: { key } });
    return priceOrDefault(type, currency, row?.value);
  }

  /** Set the price for a session type in a currency (rubles when omitted). */
  async setPrice(
    type: SessionType,
    amount: number,
    currency: Currency = 'RUB',
  ) {
    const key = priceKey(type, currency);
    const value = String(validPrice(type, amount));
    await this.prisma.bookingSetting.upsert({
      where: { key },
      create: { key, value },
      update: { value },
    });
  }

  /** Public session catalogue with current prices in every currency, for the UI. */
  async getOptions() {
    return Promise.all(
      SESSION_META.map(async (m) => {
        const prices = await pricesByCurrency((c) => this.getPrice(m.type, c));
        return { ...m, price: prices.RUB, prices };
      }),
    );
  }
}
