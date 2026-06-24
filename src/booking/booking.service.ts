import { Injectable, Logger, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { BookingNotifyService } from './booking-notify.service';
import { MeetingService } from './meeting.service';
import { RobokassaService } from './robokassa.service';
import { encryptRecord, decryptRecord, EncryptSchema } from '../utils/crypto';
import { BookingStatus, SessionType } from '@prisma/client';
import { randomUUID } from 'crypto';

const SESSION_PRICE: Record<SessionType, number> = {
  [SessionType.INTRO_15]: 0,
  [SessionType.SESSION_50]: 3500,
};

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
}

const SCHEMA: EncryptSchema = {
  strings: ['clientName', 'clientContact', 'message'],
};

const HOLD_MINUTES = 15;

@Injectable()
export class BookingService {
  private readonly logger = new Logger(BookingService.name);
  private readonly siteUrl: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly notify: BookingNotifyService,
    private readonly meeting: MeetingService,
    private readonly robokassa: RobokassaService,
    config: ConfigService,
  ) {
    this.siteUrl = (config.get<string>('SITE_URL') ?? 'https://schemalab.ru').replace(/\/$/, '');
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
    // Returning client: the contact must match an existing personal meeting,
    // otherwise we'd silently create a duplicate room. Reject with a code the
    // frontend turns into a friendly "check your contact" message.
    if (dto.returning && !(await this.meeting.hasMeetingForContact(dto.clientContact))) {
      throw new BadRequestException('CLIENT_NOT_FOUND');
    }
    await this.assertSlotFree(dto.startsAt, dto.durationMin);

    const isFree = dto.type === SessionType.INTRO_15;
    const heldUntil = isFree ? null : new Date(Date.now() + HOLD_MINUTES * 60_000);
    const cancelToken = randomUUID();

    const data: any = encryptRecord(
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
      },
      SCHEMA,
    );

    const booking = await this.prisma.booking.create({ data });
    this.logger.log(`Booking ${booking.id} created (${isFree ? 'CONFIRMED' : 'HELD'})`);

    if (isFree) {
      const plain = decryptRecord(booking, SCHEMA) as any;
      await this.notify.onConfirmed(plain);
      return { id: booking.id, cancelToken, heldUntil: null, status: BookingStatus.CONFIRMED, paymentUrl: null, meetingUrl: plain.meetingUrl ?? null };
    }

    // Paid session — build Robokassa payment URL if configured.
    let paymentUrl: string | null = null;
    let meetingUrl: string | null = null;
    if (this.robokassa.enabled) {
      const price = SESSION_PRICE[dto.type];
      paymentUrl = this.robokassa.buildPaymentUrl({
        invId: booking.id,
        amount: price,
        desc: `Психологическая сессия ${new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Moscow' }).format(dto.startsAt)} МСК`,
        successUrl: `${this.siteUrl}/api/payment/success`,
        failUrl: `${this.siteUrl}/api/payment/fail`,
      });
    } else {
      // Robokassa not configured (dev): auto-confirm so slot isn't stuck in HELD.
      await this.prisma.booking.update({ where: { id: booking.id }, data: { status: BookingStatus.CONFIRMED, heldUntil: null } });
      const plain = decryptRecord(booking, SCHEMA) as any;
      await this.notify.onConfirmed(plain);
      meetingUrl = plain.meetingUrl ?? null;
    }

    return { id: booking.id, cancelToken, heldUntil, status: booking.status, paymentUrl, meetingUrl };
  }

  /** Confirm a HELD booking (e.g. after payment or manual admin action). */
  async confirm(id: number) {
    const booking = await this.prisma.booking.findUnique({ where: { id } });
    if (!booking) throw new NotFoundException('Booking not found');
    if (booking.status !== BookingStatus.HELD) {
      throw new ConflictException(`Cannot confirm booking in status ${booking.status}`);
    }

    await this.prisma.booking.update({
      where: { id },
      data: { status: BookingStatus.CONFIRMED, heldUntil: null },
    });

    await this.notify.onConfirmed(decryptRecord(booking, SCHEMA) as any);
    this.logger.log(`Booking ${id} CONFIRMED`);
    return { ok: true };
  }

  /** Cancel via self-service token (client link) or by admin. */
  async cancel(cancelToken: string) {
    const booking = await this.prisma.booking.findUnique({ where: { cancelToken } });
    if (!booking) throw new NotFoundException('Booking not found');
    if (booking.status === BookingStatus.CANCELLED) return { ok: true };
    if (booking.status === BookingStatus.COMPLETED) {
      throw new BadRequestException('Cannot cancel completed session');
    }

    await this.prisma.booking.update({
      where: { cancelToken },
      data: { status: BookingStatus.CANCELLED, heldUntil: null },
    });

    await this.notify.onCancelled(decryptRecord(booking, SCHEMA) as any, booking.calDavUid);
    this.logger.log(`Booking ${booking.id} CANCELLED`);
    return { ok: true };
  }

  /**
   * List bookings for the admin panel.
   *   upcoming  — future HELD + CONFIRMED (default)
   *   past      — anything already started
   *   cancelled — cancelled/expired
   *   all       — everything, most recent first
   */
  async list(filter: 'upcoming' | 'past' | 'cancelled' | 'all' = 'upcoming') {
    const now = new Date();
    const where =
      filter === 'past'      ? { startsAt: { lt: now } } :
      filter === 'cancelled' ? { status: BookingStatus.CANCELLED } :
      filter === 'all'       ? {} :
      { startsAt: { gte: now }, status: { in: [BookingStatus.HELD, BookingStatus.CONFIRMED] } };
    const rows = await this.prisma.booking.findMany({
      where,
      orderBy: { startsAt: filter === 'upcoming' ? 'asc' : 'desc' },
      take: 200,
    });
    return rows.map((r) => decryptRecord(r, SCHEMA));
  }

  async getById(id: number) {
    const booking = await this.prisma.booking.findUnique({ where: { id } });
    if (!booking) throw new NotFoundException('Booking not found');
    return decryptRecord(booking, SCHEMA);
  }

  /** Expire HELD bookings whose hold window has passed. Runs every minute. */
  @Cron('* * * * *')
  async expireHolds() {
    const expiring = await this.prisma.booking.findMany({
      where: { status: BookingStatus.HELD, heldUntil: { lte: new Date() } },
    });
    if (!expiring.length) return;
    await this.prisma.booking.updateMany({
      where: { id: { in: expiring.map((b) => b.id) } },
      data: { status: BookingStatus.CANCELLED, heldUntil: null },
    });
    this.logger.log(`Expired ${expiring.length} HELD booking(s)`);
    await this.notify.notifyExpired(expiring.map((b) => decryptRecord(b, SCHEMA) as any));
  }

  // ── private ────────────────────────────────────────────────────────────────

  // Overlap test: an existing HELD/CONFIRMED booking collides when
  // existing.startsAt < newEnd AND existing.end > newStart. Prisma can't add
  // durationMin to startsAt in a filter, so we narrow by startsAt then check
  // the computed end in JS.
  private async assertSlotFree(startsAt: Date, durationMin: number) {
    const endsAt = new Date(startsAt.getTime() + durationMin * 60_000);
    const candidates = await this.prisma.booking.findMany({
      where: {
        status: { in: [BookingStatus.HELD, BookingStatus.CONFIRMED] },
        startsAt: { lt: endsAt },
      },
    });
    for (const c of candidates) {
      const cEnd = new Date(c.startsAt.getTime() + c.durationMin * 60_000);
      if (cEnd > startsAt) throw new ConflictException('Slot already taken');
    }
  }
}
