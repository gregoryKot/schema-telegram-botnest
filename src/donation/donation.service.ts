import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { RobokassaService } from '../booking/robokassa.service';
import { BookingNotifyService } from '../booking/booking-notify.service';
import { encryptRecord, decryptRecord, EncryptSchema } from '../utils/crypto';

// Donation InvId is offset so it never collides with booking InvId (booking uses
// booking.id directly). Both share one Robokassa shop → one Result URL, which
// dispatches by range. Stays within Robokassa's int32 InvId limit.
export const DONATION_INVID_BASE = 1_000_000_000;

const SCHEMA: EncryptSchema = { strings: ['email', 'comment'] };
const MIN = 10;
const MAX = 100_000;

export interface CreateDonationDto {
  amount: number;
  source?: 'app' | 'game';
  email?: string;
  comment?: string;
}

@Injectable()
export class DonationService {
  private readonly logger = new Logger(DonationService.name);
  private readonly appUrl: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly robokassa: RobokassaService,
    private readonly notify: BookingNotifyService,
    config: ConfigService,
  ) {
    this.appUrl = (config.get<string>('APP_URL') ?? 'https://schemehappens.ru').replace(/\/$/, '');
  }

  // Donations occupy [1e9, 2e9); subscriptions start at 2e9. Bounded so a
  // subscription InvId is never mistaken for a donation.
  static isDonationInvId(invId: number): boolean {
    return invId >= DONATION_INVID_BASE && invId < 2_000_000_000;
  }

  /** Create a donation and return a Robokassa payment URL (or null in dev). */
  async create(dto: CreateDonationDto) {
    const amount = Math.round(Number(dto.amount));
    if (!Number.isFinite(amount) || amount < MIN || amount > MAX) {
      throw new BadRequestException(`Сумма должна быть от ${MIN} до ${MAX} ₽`);
    }
    const source = dto.source === 'game' ? 'game' : 'app';

    const row = await this.prisma.donation.create({
      data: encryptRecord(
        { amount, source, email: dto.email?.trim() || null, comment: dto.comment?.trim() || null, status: 'pending' },
        SCHEMA,
      ) as any,
    });
    this.logger.log(`Donation ${row.id} created (${amount}₽, ${source})`);

    if (!this.robokassa.enabled) {
      // Dev / not configured — mark paid immediately so the flow is testable.
      await this.markPaid(row.id);
      return { id: row.id, paymentUrl: null as string | null };
    }

    // Return to the PUBLIC /donate page (the app root forces login for guests).
    const ret = `${this.appUrl}/donate`;
    const paymentUrl = this.robokassa.buildPaymentUrl({
      invId: DONATION_INVID_BASE + row.id,
      amount,
      desc: 'Поддержка проекта SchemeHappens',
      email: dto.email?.trim() || undefined,
      successUrl: `${ret}?donation=ok`,
      failUrl: `${ret}?donation=fail`,
    });
    return { id: row.id, paymentUrl };
  }

  /** Mark paid from a Robokassa webhook InvId (already validated). Idempotent. */
  async markPaidByInvId(invId: number) {
    return this.markPaid(invId - DONATION_INVID_BASE);
  }

  private async markPaid(id: number) {
    const row = await this.prisma.donation.findUnique({ where: { id } });
    if (!row || row.status === 'paid') return { ok: true };
    await this.prisma.donation.update({ where: { id }, data: { status: 'paid', paidAt: new Date() } });
    const plain = decryptRecord(row, SCHEMA) as any;
    await this.notify.alertAdmin(
      `💛 <b>Донат ${row.amount} ₽</b> (${row.source})` +
      (plain.email ? `\n📬 ${plain.email}` : '') +
      (plain.comment ? `\n💬 ${plain.comment}` : ''),
    );
    this.logger.log(`Donation ${id} PAID`);
    return { ok: true };
  }
}
