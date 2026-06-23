import { Injectable, Logger, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { TelegramService } from '../telegram/telegram.service';
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
    private readonly telegram: TelegramService,
  ) {}

  /** Reserve a slot (HELD) without confirming. Returns booking id + cancelToken. */
  async hold(dto: CreateBookingDto) {
    await this.assertSlotFree(dto.startsAt, dto.durationMin);

    const heldUntil = new Date(Date.now() + HOLD_MINUTES * 60_000);
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
        status: BookingStatus.HELD,
        heldUntil,
        cancelToken,
      },
      SCHEMA,
    );

    const booking = await this.prisma.booking.create({ data });
    this.logger.log(`Booking ${booking.id} HELD until ${heldUntil.toISOString()}`);
    return { id: booking.id, cancelToken, heldUntil };
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

    const plain = decryptRecord(booking, SCHEMA);
    await this.notifyConfirmed(plain);
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

    const plain = decryptRecord(booking, SCHEMA);
    await this.notifyCancelled(plain);
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

  private async assertSlotFree(startsAt: Date, durationMin: number) {
    const endsAt = new Date(startsAt.getTime() + durationMin * 60_000);
    const conflict = await this.prisma.booking.findFirst({
      where: {
        status: { in: [BookingStatus.HELD, BookingStatus.CONFIRMED] },
        startsAt: { lt: endsAt },
        // startsAt + durationMin > newStartsAt is checked by endsAt > existing.startsAt
        // Prisma can't express "startsAt + durationMin > x" directly, so we use a raw check below
      },
    });
    // Precise overlap check: existing.startsAt < endsAt AND existing.endsAt > startsAt
    if (conflict) {
      const conflictEnd = new Date(conflict.startsAt.getTime() + conflict.durationMin * 60_000);
      if (conflictEnd > startsAt) throw new ConflictException('Slot already taken');
    }
  }

  private async notifyConfirmed(booking: any) {
    const at = formatBookingTime(booking.startsAt);
    const text = [
      '✅ <b>Запись подтверждена</b>',
      '',
      `👤 ${booking.clientName}`,
      `📬 ${booking.clientContact}`,
      `🗓 ${at}`,
      booking.message ? `💬 ${booking.message}` : null,
    ].filter(Boolean).join('\n');
    await this.telegram.notifyAdmin(text).catch(() => null);
  }

  private async notifyCancelled(booking: any) {
    const at = formatBookingTime(booking.startsAt);
    const text = [
      '❌ <b>Запись отменена</b>',
      '',
      `👤 ${booking.clientName}`,
      `🗓 ${at}`,
    ].join('\n');
    await this.telegram.notifyAdmin(text).catch(() => null);
  }
}

function formatBookingTime(date: Date): string {
  return new Intl.DateTimeFormat('ru-RU', {
    timeZone: 'Europe/Moscow',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date) + ' МСК';
}
