import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { RobokassaService } from '../booking/robokassa.service';
import { BookingNotifyService } from '../booking/booking-notify.service';
import { encryptRecord, decryptRecord, EncryptSchema } from '../utils/crypto';
import { normalizeBaseUrl } from '../utils/url';

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
    this.appUrl = normalizeBaseUrl(
      config.get<string>('APP_URL'),
      'https://schemehappens.ru',
    );
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

    let row: { id: number };
    try {
      row = await this.prisma.donation.create({
        data: encryptRecord(
          {
            amount,
            source,
            email: dto.email?.trim() || null,
            comment: dto.comment?.trim() || null,
            status: 'pending',
          },
          SCHEMA,
        ),
      });
    } catch (e) {
      // Известная дыра (docs/SHIELD_PROMPT.md): DonationController.donate()
      // не оборачивает create() в try/catch — если сам INSERT падает (БД
      // недоступна), исключение раньше молча улетало клиенту 500-кой, и
      // никто не узнавал. Хуже, чем «оплата прошла, а донат не
      // подтвердился» (payment.controller.ts): здесь нет даже строки в БД,
      // за которую можно зацепиться при ручной сверке.
      //
      // Канал — ТОТ ЖЕ, что уже используют соседние денежные пути в
      // payment.controller.ts для «PAID, но запись не подтвердилась»:
      // this.logger.error() со стабильным текстом (троттлинг по тексту —
      // AlertLogger, main.ts, 60с) + this.notify.alertAdmin() (DM в Telegram
      // с e-mail фолбэком). Новый канал не заводим.
      //
      // Пробрасываем ДАЛЬШЕ: DonationController ничего не ловит, поэтому
      // исключение и так превратится в HTTP-ошибку клиенту — тихий успех
      // здесь был бы нечестен (донат не создан, а UI сказал бы «спасибо»).
      this.logger.error(
        `Donation create() DB write failed: ${(e as Error).message}`,
      );
      await this.notify.alertAdmin(
        `🚨 <b>Донат не создался — ошибка БД</b>\n${amount} ₽ (${source}). ` +
          `Запись не сохранилась, проверьте вручную, оплата могла не пройти.`,
      );
      throw e;
    }
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
  async markPaidByInvId(invId: number, paidAmount?: number) {
    return this.markPaid(invId - DONATION_INVID_BASE, paidAmount);
  }

  private async markPaid(id: number, paidAmount?: number) {
    const row = await this.prisma.donation.findUnique({ where: { id } });
    if (!row || row.status === 'paid') return { ok: true };
    // Defense in depth: the paid amount is already signature-bound, but flag any
    // mismatch with the recorded amount so a misconfig can't slip through.
    if (paidAmount != null && Math.round(paidAmount) !== row.amount) {
      await this.notify.alertAdmin(
        `⚠️ <b>Донат #${id}: сумма расходится</b>\nОжидали ${row.amount} ₽, оплатили ${paidAmount} ₽. Проверьте вручную.`,
      );
    }
    // P-2 (аудит 2026-07): CAS — ретраи webhook не задваивают алерт админу.
    const claimed = await this.prisma.donation.updateMany({
      where: { id, status: { not: 'paid' } },
      data: { status: 'paid', paidAt: new Date() },
    });
    if (claimed.count === 0) return { ok: true };
    const plain = decryptRecord(row, SCHEMA);
    await this.notify.alertAdmin(
      `💛 <b>Донат ${row.amount} ₽</b> (${row.source})` +
        (plain.email ? `\n📬 ${plain.email}` : '') +
        (plain.comment ? `\n💬 ${plain.comment}` : ''),
    );
    this.logger.log(`Donation ${id} PAID`);
    return { ok: true };
  }
}
