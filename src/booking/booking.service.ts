import {
  Injectable,
  Logger,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { BookingNotifyService } from './booking-notify.service';
import { MeetingService } from './meeting.service';
import { RobokassaService } from './robokassa.service';
import { encryptRecord, decryptRecord, EncryptSchema } from '../utils/crypto';
import { PricingService } from './pricing.service';
import { MIN_BOOK_LEAD_HOURS, MIN_CANCEL_LEAD_HOURS } from './booking.config';
import { BookingStatus, SessionType } from '@prisma/client';
import { randomUUID } from 'crypto';
import {
  assertWithinAvailability,
  assertSlotFree,
} from './booking.availability';
import { completeCheckout } from './booking.checkout';
import {
  listBookings,
  getBookingById,
  getPublicBookingByToken,
} from './booking.queries';
import { CronLeaderService, LEASE_WINDOW } from '../infra/cron-leader.service';

export interface CreateBookingDto {
  startsAt: Date;
  durationMin: number;
  type: SessionType;
  clientName: string;
  clientContact: string;
  message?: string;
  clientTelegramId?: bigint;
  /** Client ticked "returning visit" — require an existing personal meeting. */
  returning?: boolean;
  /** Client ticked the public-offer consent checkbox. Required to take payment. */
  acceptedOffer?: boolean;
  /** Атрибуция лида (страница + referrer). Не PII, хранится открыто. */
  source?: string;
}

const SCHEMA: EncryptSchema = {
  strings: ['clientName', 'clientContact', 'message'],
};

const HOLD_MINUTES = 15;
// Ключ pg_advisory_xact_lock для сериализации «проверить слот → создать бронь».
// Один глобальный лок на все брони: трафик записи низкий, сериализация дешевле,
// чем exclusion constraint по времени (P-1, аудит 2026-07).
const BOOKING_SLOT_LOCK_KEY = 911_001;

/**
 * Thrown by confirm() specifically when the webhook-reported paid amount
 * doesn't match the expected price. Deliberately a distinct subclass of
 * ConflictException (not a plain one) so PaymentController can tell it apart
 * from the ordinary idempotent-repeat ConflictException: the two need
 * opposite Robokassa acks — repeat → "OK" (stop retrying, already handled),
 * mismatch → "FAIL" (keep retrying / keep it visible, it is NOT handled).
 */
export class PaymentAmountMismatchError extends ConflictException {}

@Injectable()
export class BookingService {
  private readonly logger = new Logger(BookingService.name);
  private readonly siteUrl: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly notify: BookingNotifyService,
    private readonly meeting: MeetingService,
    private readonly robokassa: RobokassaService,
    private readonly pricing: PricingService,
    config: ConfigService,
    private readonly cronLeader: CronLeaderService,
  ) {
    this.siteUrl = (
      config.get<string>('SITE_URL') ?? 'https://kotlarewski.gr'
    ).replace(/\/$/, '');
  }

  /**
   * Create a booking.
   *
   * INTRO_15 (free): confirmed immediately, admin + CalDAV notified.
   * SESSION_50 (paid): created as HELD for 15 min. If Robokassa is configured,
   * returns a paymentUrl the client must visit to complete payment. On webhook,
   * PaymentController calls confirm(). If Robokassa is not configured, also
   * confirms immediately (useful for dev / manual-payment flow).
   */
  async book(dto: CreateBookingDto) {
    if (!dto.clientName || !dto.clientContact) {
      throw new BadRequestException('Name and contact required');
    }
    // The public offer must be accepted before we take any booking — this is the
    // legal basis for the (paid) session. Enforced server-side, not just in UI.
    if (!dto.acceptedOffer) {
      throw new BadRequestException('OFFER_NOT_ACCEPTED');
    }
    // Returning client: the contact must match an existing personal meeting,
    // otherwise we'd silently create a duplicate room. Reject with a code the
    // frontend turns into a friendly "check your contact" message.
    if (
      dto.returning &&
      !(await this.meeting.hasMeetingForContact(dto.clientContact))
    ) {
      throw new BadRequestException('CLIENT_NOT_FOUND');
    }
    // No last-minute bookings: the slot must be at least MIN_BOOK_LEAD_HOURS away.
    if (dto.startsAt.getTime() < Date.now() + MIN_BOOK_LEAD_HOURS * 3_600_000) {
      throw new BadRequestException('TOO_SOON');
    }
    // P-5 (аудит 2026-07): расписание проверялось только при ОТОБРАЖЕНИИ
    // слотов — прямой POST мог забронировать 3 часа ночи любой длительности.
    await assertWithinAvailability(this.prisma, dto.startsAt, dto.durationMin);
    const isFree = dto.type === SessionType.INTRO_15;
    const heldUntil = isFree
      ? null
      : new Date(Date.now() + HOLD_MINUTES * 60_000);
    const cancelToken = randomUUID();

    const data = encryptRecord(
      {
        startsAt: dto.startsAt,
        durationMin: dto.durationMin,
        type: dto.type,
        clientName: dto.clientName,
        clientContact: dto.clientContact,
        message: dto.message ?? null,
        clientTelegramId: dto.clientTelegramId ?? null,
        status: isFree ? BookingStatus.CONFIRMED : BookingStatus.HELD,
        heldUntil,
        cancelToken,
        acceptedOfferAt: new Date(),
        source: dto.source?.slice(0, 200) ?? null,
      },
      SCHEMA,
    );

    // P-1 (аудит 2026-07): проверка занятости и создание — в одной транзакции
    // под advisory-lock, иначе два клиента, кликнувшие одновременно, оба
    // проходили findMany-проверку и бронировали один слот (TOCTOU).
    // Lock — xact-scoped: снимается автоматически на commit/rollback.
    const booking = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(${BOOKING_SLOT_LOCK_KEY})`;
      await assertSlotFree(tx, dto.startsAt, dto.durationMin);
      return tx.booking.create({ data });
    });
    this.logger.log(
      `Booking ${booking.id} created (${isFree ? 'CONFIRMED' : 'HELD'})`,
    );

    return completeCheckout(
      {
        prisma: this.prisma,
        notify: this.notify,
        robokassa: this.robokassa,
        pricing: this.pricing,
        siteUrl: this.siteUrl,
        schema: SCHEMA,
      },
      booking,
      {
        isFree,
        cancelToken,
        heldUntil,
        startsAt: dto.startsAt,
        type: dto.type,
        clientContact: dto.clientContact,
      },
    );
  }

  /** Confirm a HELD booking (e.g. after payment or manual admin action).
   * @param paidAmount  when confirming from a payment webhook, the amount paid —
   *                    verified against the expected price (defense in depth). */
  async confirm(id: number, paidAmount?: number) {
    const booking = await this.prisma.booking.findUnique({ where: { id } });
    if (!booking) throw new NotFoundException('Booking not found');
    // P-4 (аудит 2026-07): расхождение суммы БЛОКИРУЕТ авто-подтверждение,
    // а не только алертит. Бронь остаётся HELD — админ разбирается вручную
    // (подпись Robokassa уже привязывает сумму, так что сюда попадёт только
    // рассинхрон нашего прайса между выпиской счёта и оплатой).
    if (paidAmount != null) {
      const expected = await this.pricing.getPrice(booking.type);
      if (Math.round(paidAmount) !== expected) {
        await this.notify.alertAdmin(
          `⚠️ <b>Бронь #${id}: сумма расходится</b>\nОжидали ${expected} ₽, оплатили ${paidAmount} ₽. Бронь НЕ подтверждена автоматически — проверьте и подтвердите вручную.`,
        );
        throw new PaymentAmountMismatchError('Amount mismatch — manual review');
      }
    }

    // P-2: атомарный CAS вместо check-then-act — параллельные ретраи webhook
    // Robokassa не задваивают side-effects (уведомление, meeting-линк):
    // updateMany выигрывает ровно один вызов.
    const claimed = await this.prisma.booking.updateMany({
      where: { id, status: BookingStatus.HELD },
      data: { status: BookingStatus.CONFIRMED, heldUntil: null },
    });
    if (claimed.count === 0) {
      const now = await this.prisma.booking.findUnique({
        where: { id },
        select: { status: true },
      });
      // Повторный webhook по уже подтверждённой броне — идемпотентный успех.
      if (now?.status === BookingStatus.CONFIRMED) return { ok: true };
      throw new ConflictException(
        `Cannot confirm booking in status ${now?.status ?? 'UNKNOWN'}`,
      );
    }

    await this.notify.onConfirmed(decryptRecord(booking, SCHEMA));
    this.logger.log(`Booking ${id} CONFIRMED`);
    return { ok: true };
  }

  /**
   * Cancel via self-service token (client link).
   * @param enforceCutoff  when true (client path), block cancellation inside the
   *                       MIN_CANCEL_LEAD_HOURS window. Admin flows can pass false.
   */
  async cancel(cancelToken: string, enforceCutoff = true) {
    const booking = await this.prisma.booking.findUnique({
      where: { cancelToken },
    });
    if (!booking) throw new NotFoundException('Booking not found');
    if (booking.status === BookingStatus.CANCELLED) return { ok: true };
    if (booking.status === BookingStatus.COMPLETED) {
      throw new BadRequestException('Cannot cancel completed session');
    }
    // Too late to self-cancel — the client must contact the therapist directly.
    if (
      enforceCutoff &&
      booking.startsAt.getTime() <
        Date.now() + MIN_CANCEL_LEAD_HOURS * 3_600_000
    ) {
      throw new BadRequestException('CANCEL_TOO_LATE');
    }

    await this.prisma.booking.update({
      where: { cancelToken },
      data: { status: BookingStatus.CANCELLED, heldUntil: null },
    });

    await this.notify.onCancelled(
      decryptRecord(booking, SCHEMA),
      booking.calDavUid,
    );
    this.logger.log(`Booking ${booking.id} CANCELLED`);
    return { ok: true };
  }

  /** Список броней для админки — см. listBookings. */
  async list(filter: 'upcoming' | 'past' | 'cancelled' | 'all' = 'upcoming') {
    return listBookings(this.prisma, SCHEMA, filter);
  }

  async getById(id: number) {
    return getBookingById(this.prisma, SCHEMA, id);
  }

  /** Публичная проекция брони по cancel-токену (без PII). */
  async getPublicByToken(token: string) {
    return getPublicBookingByToken(this.prisma, token);
  }

  /** Expire HELD bookings whose hold window has passed. Runs every minute. */
  @Cron('* * * * *')
  async expireHolds() {
    // Без аренды второй инстанс тоже находит те же HELD-брони и рассылает
    // notifyExpired по ним ещё раз — админ получает дублирующие DM про одну
    // и ту же истёкшую бронь.
    if (
      !(await this.cronLeader.claimRun(
        'bookingExpireHolds',
        LEASE_WINDOW.everyMinute,
      ))
    )
      return;
    const expiring = await this.prisma.booking.findMany({
      where: { status: BookingStatus.HELD, heldUntil: { lte: new Date() } },
    });
    if (!expiring.length) return;
    await this.prisma.booking.updateMany({
      where: { id: { in: expiring.map((b) => b.id) } },
      data: { status: BookingStatus.CANCELLED, heldUntil: null },
    });
    this.logger.log(`Expired ${expiring.length} HELD booking(s)`);
    await this.notify.notifyExpired(
      expiring.map((b) => decryptRecord(b, SCHEMA)),
    );
  }
}
