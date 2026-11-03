import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { RobokassaService } from '../booking/robokassa.service';
import { assertPaymentAvailable } from '../booking/payment-guard';
import { BookingNotifyService } from '../booking/booking-notify.service';
import { encryptRecord, EncryptSchema } from '../utils/crypto';
import { SubPeriod } from '../booking/booking.config';
import { subPriceOrDefault } from './subscription-price';
import { normalizeBaseUrl } from '../utils/url';
import { randomUUID } from 'crypto';
import {
  markChargePaid,
  chargeDue,
  type ChargeDeps,
} from './subscription.charges';
import { SUBSCRIPTION_INVID_BASE } from './subscription.constants';
import { findActiveByTelegram } from './subscription-views';
import { CronLeaderService, LEASE_WINDOW } from '../infra/cron-leader.service';

// Прежний путь импорта константы сохранён ре-экспортом.
export { SUBSCRIPTION_INVID_BASE };

const SCHEMA: EncryptSchema = { strings: ['email'] };

export interface CreateSubscriptionDto {
  period: SubPeriod;
  email?: string;
  telegramId?: bigint;
  /** Consent to recurring auto-charges — required to start a subscription. */
  acceptedOffer?: boolean;
}

@Injectable()
export class SubscriptionService {
  private readonly logger = new Logger(SubscriptionService.name);
  private readonly appUrl: string;
  private readonly enabled: boolean;

  constructor(
    private readonly prisma: PrismaService,
    private readonly robokassa: RobokassaService,
    private readonly notify: BookingNotifyService,
    config: ConfigService,
    private readonly cronLeader: CronLeaderService,
  ) {
    this.appUrl = normalizeBaseUrl(
      config.get<string>('APP_URL'),
      'https://schemehappens.ru',
    );
    // Скрыта, пока рекуррент Robokassa не заработает (SUBSCRIPTION_ENABLED).
    this.enabled = config.get<string>('SUBSCRIPTION_ENABLED') === 'true';
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  static isSubscriptionInvId(invId: number): boolean {
    return invId >= SUBSCRIPTION_INVID_BASE;
  }

  // ── pricing ────────────────────────────────────────────────────────────────
  private priceKey(p: SubPeriod) {
    return `sub:${p}`;
  }

  async getPrice(period: SubPeriod): Promise<number> {
    const row = await this.prisma.bookingSetting.findUnique({
      where: { key: this.priceKey(period) },
    });
    return subPriceOrDefault(period, row?.value);
  }

  async setPrice(period: SubPeriod, amount: number): Promise<void> {
    const value = String(Math.max(1, Math.round(amount)));
    await this.prisma.bookingSetting.upsert({
      where: { key: this.priceKey(period) },
      create: { key: this.priceKey(period), value },
      update: { value },
    });
  }

  async getOptions() {
    return Promise.all(
      (['month', 'year'] as SubPeriod[]).map(async (p) => ({
        period: p,
        price: await this.getPrice(p),
      })),
    );
  }

  // ── lifecycle ────────────────────────────────────────────────────────────────

  /** Start a subscription: create it + the first (CIT) charge, return a payment URL. */
  async subscribe(dto: CreateSubscriptionDto) {
    if (!this.enabled)
      throw new ServiceUnavailableException('SUBSCRIPTION_DISABLED');
    // Explicit consent to recurring auto-charges is required (auto-renewal).
    if (!dto.acceptedOffer) throw new BadRequestException('OFFER_NOT_ACCEPTED');
    assertPaymentAvailable(this.robokassa, 'subscription');
    const period: SubPeriod = dto.period === 'year' ? 'year' : 'month';
    const amount = await this.getPrice(period);
    const cancelToken = randomUUID();

    const sub = await this.prisma.subscription.create({
      data: encryptRecord(
        {
          period,
          amount,
          email: dto.email?.trim() || null,
          telegramId: dto.telegramId ?? null,
          status: 'pending',
          cancelToken,
          acceptedOfferAt: new Date(),
        },
        SCHEMA,
      ),
    });
    const charge = await this.prisma.subscriptionCharge.create({
      data: { subscriptionId: sub.id, amount, isFirst: true },
    });
    this.logger.log(`Subscription ${sub.id} created (${amount}₽/${period})`);

    if (!this.robokassa.enabled) {
      // Вне прода: включаем сразу, без Robokassa (в проде отказали выше).
      await markChargePaid(
        this.chargeDeps(),
        SUBSCRIPTION_INVID_BASE + charge.id,
      );
      return { id: sub.id, cancelToken, paymentUrl: null as string | null };
    }

    const ret = `${this.appUrl}/subscribe`;
    const paymentUrl = this.robokassa.buildPaymentUrl({
      invId: SUBSCRIPTION_INVID_BASE + charge.id,
      amount,
      desc: `Подписка SchemeHappens (${period === 'year' ? 'год' : 'месяц'})`,
      email: dto.email?.trim() || undefined,
      successUrl: `${ret}?sub=ok&token=${cancelToken}`,
      failUrl: `${ret}?sub=fail`,
      recurring: true, // first payment tokenises the card
    });
    return { id: sub.id, cancelToken, paymentUrl };
  }

  /** Webhook entry: a subscription charge was paid (InvId already validated). */
  async markChargePaidByInvId(invId: number, paidAmount?: number) {
    return markChargePaid(this.chargeDeps(), invId, paidAmount);
  }

  /** Cancel a subscription (no further charges). Idempotent. */
  async cancel(cancelToken: string) {
    const sub = await this.prisma.subscription.findUnique({
      where: { cancelToken },
    });
    if (!sub) throw new NotFoundException('Subscription not found');
    if (sub.status !== 'cancelled') {
      await this.prisma.subscription.updateMany({
        where: { id: sub.id, status: { not: 'cancelled' } },
        data: { status: 'cancelled', nextChargeAt: null },
      });
      this.logger.log(`Subscription ${sub.id} CANCELLED`);
    }
    return { ok: true };
  }

  /** Public view by token (no PII) for the manage page. */
  async getPublicByToken(cancelToken: string) {
    const sub = await this.prisma.subscription.findUnique({
      where: { cancelToken },
    });
    if (!sub) throw new NotFoundException('Subscription not found');
    return {
      status: sub.status,
      period: sub.period,
      amount: sub.amount,
      nextChargeAt: sub.nextChargeAt?.toISOString() ?? null,
    };
  }

  /** Active subscription for a Telegram user (for bot management). */
  async findActiveByTelegram(telegramId: bigint) {
    return findActiveByTelegram(this.prisma, telegramId);
  }

  /** Charge subscriptions whose next charge is due. Runs hourly. */
  @Cron('0 * * * *')
  async chargeDue() {
    // Дешёвые гарды до аренды: выключенная подписка не забирает тик. Аренда —
    // второй барьер поверх построчного захвата в chargeDue (правило №17).
    if (!this.enabled || !this.robokassa.enabled) return;
    if (
      !(await this.cronLeader.claimRun(
        'subscriptionChargeDue',
        LEASE_WINDOW.hourly,
      ))
    )
      return;
    return chargeDue(this.chargeDeps());
  }

  private chargeDeps(): ChargeDeps {
    return {
      prisma: this.prisma,
      robokassa: this.robokassa,
      notify: this.notify,
      logger: this.logger,
      enabled: this.enabled,
    };
  }
}
