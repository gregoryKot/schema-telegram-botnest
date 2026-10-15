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
import { decryptRecord } from '../utils/crypto';
import { PricingService } from './pricing.service';
import { MIN_BOOK_LEAD_HOURS, MIN_CANCEL_LEAD_HOURS } from './booking.config';
import { BookingStatus, SessionType } from '@prisma/client';
import { randomUUID } from 'crypto';
import { assertWithinAvailability } from './booking.availability';
import { completeCheckout } from './booking.checkout';
import { createBookingGuarded } from './booking.create';
import { buildBookingData } from './booking-data';
import { assertBookingPayable } from './payment-guard';
import { BOOKING_SCHEMA } from './booking.schema';
import { RETURNING_NOT_FOUND_NOTE } from './booking-admin-note';
import {
  listBookings,
  getBookingById,
  getPublicBookingByToken,
} from './booking.queries';
import { CronLeaderService, LEASE_WINDOW } from '../infra/cron-leader.service';
import {
  claimCancel,
  expireHeldBookings,
  paymentAfterCancel,
} from './booking.transitions';
import { finishConfirmEffects, rerunEffects } from './booking.confirm-effects';
import type { CreateBookingDto } from './booking.types';

export type { CreateBookingDto };

const HOLD_MINUTES = 15;

/**
 * Thrown by confirm() when the webhook-reported paid amount doesn't match
 * the expected price. A distinct ConflictException subclass so PaymentController
 * tells it apart from an idempotent-repeat: opposite Robokassa acks — repeat
 * → "OK" (already handled), mismatch → "FAIL" (NOT handled, keep it visible).
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
   * PaymentController calls confirm(). Robokassa not configured: in production
   * a paid booking is refused (503) before the INSERT, otherwise (dev) it is
   * confirmed immediately — see payment-guard.ts.
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
    // security#19: ответ не зависит от того, клиент ли этот контакт (раньше
    // 400 CLIENT_NOT_FOUND vs 200 HELD — оракул). Несовпадение — пометка
    // админу. INTRO_15 — всегда первая встреча: returning игнорируем.
    const returningUnmatched =
      !!dto.returning &&
      dto.type !== SessionType.INTRO_15 &&
      !(await this.meeting.hasMeetingForContact(dto.clientContact));
    // No last-minute bookings: the slot must be at least MIN_BOOK_LEAD_HOURS away.
    if (dto.startsAt.getTime() < Date.now() + MIN_BOOK_LEAD_HOURS * 3_600_000) {
      throw new BadRequestException('TOO_SOON');
    }
    // P-5 (аудит 2026-07): расписание проверялось только при ОТОБРАЖЕНИИ
    // слотов — прямой POST мог забронировать 3 часа ночи любой длительности.
    await assertWithinAvailability(this.prisma, dto.startsAt, dto.durationMin);
    const isFree = dto.type === SessionType.INTRO_15;
    // Прод без Robokassa: отказ ДО INSERT (иначе HELD держит слот 15 минут).
    await assertBookingPayable(this.robokassa, this.notify, dto);
    const heldUntil = isFree
      ? null
      : new Date(Date.now() + HOLD_MINUTES * 60_000);
    const cancelToken = randomUUID();

    const data = buildBookingData(dto, { isFree, heldUntil, cancelToken });

    // Лок + проверка занятости + INSERT в одной транзакции, с резервом на
    // случай падения (лид уходит админу) — см. booking.create.ts.
    const booking = await createBookingGuarded(
      { prisma: this.prisma, notify: this.notify, logger: this.logger },
      data,
      dto,
    );
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
        schema: BOOKING_SCHEMA,
      },
      booking,
      {
        isFree,
        cancelToken,
        heldUntil,
        startsAt: dto.startsAt,
        type: dto.type,
        clientContact: dto.clientContact,
        adminNote: returningUnmatched ? RETURNING_NOT_FOUND_NOTE : undefined,
      },
    );
  }

  /** Confirm a HELD booking (e.g. after payment or manual admin action).
   * @param paidAmount  when confirming from a payment webhook, the amount paid —
   *                    verified against the expected price (defense in depth). */
  async confirm(id: number, paidAmount?: number) {
    const booking = await this.prisma.booking.findUnique({ where: { id } });
    if (!booking) throw new NotFoundException('Booking not found');
    // P-4 (аудит 2026-07): расхождение суммы блокирует авто-подтверждение (HELD).
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
    // не задваивают side-effects: updateMany выигрывает ровно один вызов.
    // paidAt — только при оплате вебхуком; ручное подтверждение — не оплата.
    const claimed = await this.prisma.booking.updateMany({
      where: { id, status: BookingStatus.HELD },
      data: {
        status: BookingStatus.CONFIRMED,
        heldUntil: null,
        ...(paidAmount != null && { paidAt: new Date() }),
      },
    });
    if (claimed.count === 0) {
      const now = await this.prisma.booking.findUnique({ where: { id } });
      // Повтор webhook / ручное подтверждение: эффекты доделываем, если флаг
      // пуст и проход не идёт прямо сейчас (security#21), иначе просто успех.
      if (now?.status === BookingStatus.CONFIRMED) {
        await rerunEffects(this.notify, now);
        return { ok: true };
      }
      // Деньги пришли, а бронь CANCELLED: факт оплаты в БД, затем сигнал.
      if (now?.status === BookingStatus.CANCELLED && paidAmount != null) {
        throw await paymentAfterCancel(
          this.prisma,
          decryptRecord(booking, BOOKING_SCHEMA),
          paidAmount,
        );
      }
      throw new ConflictException(
        `Cannot confirm booking in status ${now?.status ?? 'UNKNOWN'}`,
      );
    }

    await finishConfirmEffects(this.notify, booking);
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

    // CAS (аудит 2026-10-11): параллельные отмены не задваивают эффекты; они
    // идут по свежей строке (calDavUid мог записать выигравший confirm).
    const claimed = await claimCancel(this.prisma, cancelToken, booking);
    if (!claimed) return { ok: true };

    await this.notify.onCancelled(
      decryptRecord(claimed.row, BOOKING_SCHEMA),
      claimed.eventUid,
    );
    this.logger.log(`Booking ${booking.id} CANCELLED`);
    return { ok: true };
  }

  /** Список броней для админки — см. listBookings. */
  async list(filter: 'upcoming' | 'past' | 'cancelled' | 'all' = 'upcoming') {
    return listBookings(this.prisma, BOOKING_SCHEMA, filter);
  }

  async getById(id: number) {
    return getBookingById(this.prisma, BOOKING_SCHEMA, id);
  }

  /** Публичная проекция брони по cancel-токену (без PII). */
  async getPublicByToken(token: string) {
    return getPublicBookingByToken(this.prisma, token);
  }

  /** Expire HELD bookings whose hold window has passed. Runs every minute. */
  @Cron('* * * * *')
  async expireHolds() {
    // Без аренды второй инстанс рассылает notifyExpired по тем же броням —
    // админ получает дубли DM про одну истёкшую бронь.
    if (
      !(await this.cronLeader.claimRun(
        'bookingExpireHolds',
        LEASE_WINDOW.everyMinute,
      ))
    )
      return;
    // CAS построчно (аудит 2026-10-11, r2-1#0): оплаченную за миллисекунды до
    // тика бронь крон не перекрашивает, а «истекла без оплаты» шлётся только
    // по строкам, которые перевёл именно этот тик.
    const expired = await expireHeldBookings(this.prisma);
    if (!expired.length) return;
    this.logger.log(`Expired ${expired.length} HELD booking(s)`);
    await this.notify.notifyExpired(
      expired.map((b) => decryptRecord(b, BOOKING_SCHEMA)),
    );
  }
}
