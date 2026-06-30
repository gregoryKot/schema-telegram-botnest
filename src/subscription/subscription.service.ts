import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { RobokassaService } from '../booking/robokassa.service';
import { BookingNotifyService } from '../booking/booking-notify.service';
import { encryptRecord, decryptRecord, EncryptSchema } from '../utils/crypto';
import { SUB_DEFAULT_PRICE, SubPeriod } from '../booking/booking.config';
import { randomUUID } from 'crypto';

// Subscription charges live in their own InvId range so the shared Robokassa
// Result webhook can route by range. Below int32 max (2_147_483_647).
export const SUBSCRIPTION_INVID_BASE = 2_000_000_000;

const SCHEMA: EncryptSchema = { strings: ['email'] };
const MAX_FAILS = 3; // after this many failed recurring charges → past_due

export interface CreateSubscriptionDto {
  period: SubPeriod;
  email?: string;
  telegramId?: bigint;
}

@Injectable()
export class SubscriptionService {
  private readonly logger = new Logger(SubscriptionService.name);
  private readonly appUrl: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly robokassa: RobokassaService,
    private readonly notify: BookingNotifyService,
    config: ConfigService,
  ) {
    this.appUrl = (config.get<string>('APP_URL') ?? 'https://schemehappens.ru').replace(/\/$/, '');
  }

  static isSubscriptionInvId(invId: number): boolean {
    return invId >= SUBSCRIPTION_INVID_BASE;
  }

  // ── pricing ────────────────────────────────────────────────────────────────
  private priceKey(p: SubPeriod) { return `sub:${p}`; }

  async getPrice(period: SubPeriod): Promise<number> {
    const row = await this.prisma.bookingSetting.findUnique({ where: { key: this.priceKey(period) } });
    const n = row ? parseInt(row.value, 10) : NaN;
    return Number.isFinite(n) && n > 0 ? n : SUB_DEFAULT_PRICE[period];
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
    return Promise.all((['month', 'year'] as SubPeriod[]).map(async (p) => ({ period: p, price: await this.getPrice(p) })));
  }

  // ── lifecycle ────────────────────────────────────────────────────────────────

  /** Start a subscription: create it + the first (CIT) charge, return a payment URL. */
  async subscribe(dto: CreateSubscriptionDto) {
    const period: SubPeriod = dto.period === 'year' ? 'year' : 'month';
    const amount = await this.getPrice(period);
    const cancelToken = randomUUID();

    const sub = await this.prisma.subscription.create({
      data: encryptRecord(
        { period, amount, email: dto.email?.trim() || null, telegramId: dto.telegramId ?? null, status: 'pending', cancelToken },
        SCHEMA,
      ) as any,
    });
    const charge = await this.prisma.subscriptionCharge.create({
      data: { subscriptionId: sub.id, amount, isFirst: true },
    });
    this.logger.log(`Subscription ${sub.id} created (${amount}₽/${period})`);

    if (!this.robokassa.enabled) {
      // Dev — activate immediately so the flow is testable without Robokassa.
      await this.markChargePaid(SUBSCRIPTION_INVID_BASE + charge.id);
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
  async markChargePaidByInvId(invId: number) {
    return this.markChargePaid(invId);
  }

  private async markChargePaid(invId: number) {
    const chargeId = invId - SUBSCRIPTION_INVID_BASE;
    const charge = await this.prisma.subscriptionCharge.findUnique({ where: { id: chargeId } });
    if (!charge || charge.status === 'paid') return { ok: true };

    const sub = await this.prisma.subscription.findUnique({ where: { id: charge.subscriptionId } });
    if (!sub) return { ok: true };

    const next = addPeriod(new Date(), sub.period as SubPeriod);
    await this.prisma.$transaction([
      this.prisma.subscriptionCharge.update({ where: { id: chargeId }, data: { status: 'paid', paidAt: new Date() } }),
      this.prisma.subscription.update({
        where: { id: sub.id },
        data: {
          status: 'active',
          lastChargeAt: new Date(),
          nextChargeAt: next,
          failedAttempts: 0,
          // The first paid charge becomes the PreviousInvoiceID for all future charges.
          ...(charge.isFirst ? { firstInvId: invId } : {}),
        },
      }),
    ]);

    const plain = decryptRecord(sub, SCHEMA) as any;
    await this.notify.alertAdmin(
      `${charge.isFirst ? '🎉 <b>Новая подписка</b>' : '🔁 <b>Продление подписки</b>'} ${sub.amount} ₽/${sub.period === 'year' ? 'год' : 'мес'}` +
      (plain.email ? `\n📬 ${plain.email}` : '') +
      (sub.telegramId ? `\n👤 tg:${sub.telegramId}` : ''),
    );
    this.logger.log(`Subscription ${sub.id} ${charge.isFirst ? 'ACTIVATED' : 'RENEWED'} → next ${next.toISOString()}`);
    return { ok: true };
  }

  /** Cancel a subscription (no further charges). Idempotent. */
  async cancel(cancelToken: string) {
    const sub = await this.prisma.subscription.findUnique({ where: { cancelToken } });
    if (!sub) throw new NotFoundException('Subscription not found');
    if (sub.status !== 'cancelled') {
      await this.prisma.subscription.update({ where: { id: sub.id }, data: { status: 'cancelled', nextChargeAt: null } });
      this.logger.log(`Subscription ${sub.id} CANCELLED`);
    }
    return { ok: true };
  }

  /** Public view by token (no PII) for the manage page. */
  async getPublicByToken(cancelToken: string) {
    const sub = await this.prisma.subscription.findUnique({ where: { cancelToken } });
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
    const sub = await this.prisma.subscription.findFirst({
      where: { telegramId, status: { in: ['active', 'past_due'] } },
      orderBy: { createdAt: 'desc' },
    });
    return sub ? { id: sub.id, status: sub.status, period: sub.period, amount: sub.amount, nextChargeAt: sub.nextChargeAt, cancelToken: sub.cancelToken } : null;
  }

  /** Charge subscriptions whose next charge is due. Runs hourly. */
  @Cron('0 * * * *')
  async chargeDue() {
    if (!this.robokassa.enabled) return;
    const due = await this.prisma.subscription.findMany({
      where: { status: { in: ['active', 'past_due'] }, nextChargeAt: { lte: new Date() }, firstInvId: { not: null } },
      take: 50,
    });
    for (const sub of due) {
      const charge = await this.prisma.subscriptionCharge.create({ data: { subscriptionId: sub.id, amount: sub.amount } });
      const res = await this.robokassa.chargeRecurring({
        invId: SUBSCRIPTION_INVID_BASE + charge.id,
        previousInvId: sub.firstInvId!,
        amount: sub.amount,
        desc: `Подписка SchemeHappens (${sub.period === 'year' ? 'год' : 'месяц'})`,
      });
      if (res.ok) {
        // Payment accepted — confirmation + nextChargeAt advance happen on the webhook.
        this.logger.log(`Subscription ${sub.id} recurring charge sent (InvId=${SUBSCRIPTION_INVID_BASE + charge.id})`);
      } else {
        const fails = sub.failedAttempts + 1;
        await this.prisma.$transaction([
          this.prisma.subscriptionCharge.update({ where: { id: charge.id }, data: { status: 'failed' } }),
          this.prisma.subscription.update({
            where: { id: sub.id },
            data: {
              failedAttempts: fails,
              status: fails >= MAX_FAILS ? 'past_due' : sub.status,
              // Retry in a day unless we've given up.
              nextChargeAt: fails >= MAX_FAILS ? null : new Date(Date.now() + 24 * 3_600_000),
            },
          }),
        ]);
        await this.notify.alertAdmin(`⚠️ <b>Не удалось списать подписку #${sub.id}</b> (${fails}/${MAX_FAILS})\n${res.body.slice(0, 150)}`);
      }
    }
    if (due.length) this.logger.log(`Processed ${due.length} due subscription(s)`);
  }
}

/** Add one billing period to a date. */
function addPeriod(d: Date, period: SubPeriod): Date {
  const r = new Date(d);
  if (period === 'year') r.setUTCFullYear(r.getUTCFullYear() + 1);
  else r.setUTCMonth(r.getUTCMonth() + 1);
  return r;
}
