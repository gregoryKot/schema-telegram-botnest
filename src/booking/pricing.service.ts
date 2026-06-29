import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SESSION_DEFAULT_PRICE, SESSION_META, SessionOption } from './booking.config';
import { SessionType } from '@prisma/client';

const KEY = (type: SessionType) => `price:${type}`;

/** Session prices, editable in the admin panel (BookingSetting), with config defaults. */
@Injectable()
export class PricingService {
  constructor(private readonly prisma: PrismaService) {}

  /** Price for a session type — DB override if set, else the config default. */
  async getPrice(type: SessionType): Promise<number> {
    const row = await this.prisma.bookingSetting.findUnique({ where: { key: KEY(type) } });
    const n = row ? parseInt(row.value, 10) : NaN;
    return Number.isFinite(n) && n >= 0 ? n : SESSION_DEFAULT_PRICE[type];
  }

  /** Set the price for a session type (rubles). */
  async setPrice(type: SessionType, amount: number): Promise<void> {
    const value = String(Math.max(0, Math.round(amount)));
    await this.prisma.bookingSetting.upsert({
      where: { key: KEY(type) },
      create: { key: KEY(type), value },
      update: { value },
    });
  }

  /** Public session catalogue with current prices, for the UI. */
  async getOptions(): Promise<SessionOption[]> {
    return Promise.all(
      SESSION_META.map(async (m) => ({ ...m, price: await this.getPrice(m.type) })),
    );
  }
}
