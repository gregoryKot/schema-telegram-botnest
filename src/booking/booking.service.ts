import { Injectable, Logger, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { BookingNotifyService } from './booking-notify.service';
import { encryptRecord, decryptRecord, EncryptSchema } from '../utils/crypto';
import { BookingStatus, SessionType } from '@prisma/client';
import { randomUUID } from 'crypto';

export interface CreateBookingDto {
  startsAt: Date;
  durationMin: number;
  type: SessionType;
  clientName: string;
  clientContact: string;
  message?: string;
  clientTelegramId?: bigint;
}

const SCHEMA: EncryptSchema = {
  strings: ['clientName', 'clientContact', 'message'],
};

const HOLD_MINUTES = 15;

@Injectable()
export class BookingService {
  private readonly logger = new Logger(BookingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notify: BookingNotifyService,
  ) {}

  /**
   * Create a booking for a free slot.
   *
   * Free intro (INTRO_15) has no payment, so it is CONFIRMED immediately and the
   * admin/CalDAV are notified. Paid sessions (SESSION_50) are created as HELD
   * with a 15-min window for the upcoming payment step (Phase 2); the expiry
   * cron releases the slot if payment never completes.
   */
  async book(dto: CreateBookingDto) {
    if (!dto.clientName || !dto.clientContact) {
      throw new BadRequestException('Name and contact required');
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
      await this.notify.onConfirmed(decryptRecord(booking, SCHEMA) as any);
    }
    return { id: booking.id, cancelToken, heldUntil, status: booking.status };
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

  async listUpcoming() {
    const rows = await this.prisma.booking.findMany({
      where: { startsAt: { gte: new Date() }, status: { in: [BookingStatus.HELD, BookingStatus.CONFIRMED] } },
      orderBy: { startsAt: 'asc' },
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
    const expired = await this.prisma.booking.updateMany({
      where: { status: BookingStatus.HELD, heldUntil: { lte: new Date() } },
      data: { status: BookingStatus.CANCELLED, heldUntil: null },
    });
    if (expired.count > 0) {
      this.logger.log(`Expired ${expired.count} HELD booking(s)`);
    }
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
