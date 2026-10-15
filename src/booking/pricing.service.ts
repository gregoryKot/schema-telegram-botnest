import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  SESSION_DEFAULT_PRICE,
  SESSION_META,
  SessionOption,
} from './booking.config';
import { SessionType } from '@prisma/client';
import { parsePrice, validPrice } from './price-rules';

const KEY = (type: SessionType) => `price:${type}`;

/** Session prices, editable in the admin panel (BookingSetting), with config defaults. */
@Injectable()
export class PricingService {
  constructor(private readonly prisma: PrismaService) {}

  /** Price for a session type — DB override if set, else the config default. */
  async getPrice(type: SessionType): Promise<number> {
    const row = await this.prisma.bookingSetting.findUnique({
      where: { key: KEY(type) },
    });
    return parsePrice(type, row?.value) ?? SESSION_DEFAULT_PRICE[type];
  }

  /** Set the price for a session type (rubles). */
  async setPrice(type: SessionType, amount: number): Promise<void> {
    const value = String(validPrice(type, amount));
    await this.prisma.bookingSetting.upsert({
      where: { key: KEY(type) },
      create: { key: KEY(type), value },
      update: { value },
    });
  }

  /** Public session catalogue with current prices, for the UI. */
  async getOptions(): Promise<SessionOption[]> {
    return Promise.all(
      SESSION_META.map(async (m) => ({
        ...m,
        price: await this.getPrice(m.type),
      })),
    );
  }
}
