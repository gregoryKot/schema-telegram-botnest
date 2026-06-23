import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { TelegramService } from '../telegram/telegram.service';
import { CalDavService } from './caldav.service';
import { MeetingService } from './meeting.service';
import { decryptRecord, EncryptSchema } from '../utils/crypto';
import { sessionLabel } from './caldav-event.util';
import { BookingStatus, SessionType } from '@prisma/client';

const SCHEMA: EncryptSchema = { strings: ['clientName', 'clientContact', 'message'] };

interface PlainBooking {
  id: number;
  startsAt: Date;
  durationMin: number;
  type: SessionType;
  clientName: string;
  clientContact: string;
  message: string | null;
  meetingUrl: string | null;
  cancelToken: string;
}

/** All side-effects of the booking lifecycle: Telegram, CalDAV, reminders. */
@Injectable()
export class BookingNotifyService {
  private readonly logger = new Logger(BookingNotifyService.name);
  private readonly siteUrl: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly telegram: TelegramService,
    private readonly calDav: CalDavService,
    private readonly meeting: MeetingService,
    config: ConfigService,
  ) {
    this.siteUrl = (config.get<string>('SITE_URL') ?? 'https://schemalab.ru').replace(/\/$/, '');
  }

  /**
   * On confirmation: ensure a meeting link, push to Apple Calendar, notify admin.
   * Mutates b.meetingUrl so callers can return it to the client.
   */
  async onConfirmed(b: PlainBooking): Promise<void> {
    if (!b.meetingUrl) {
      b.meetingUrl = await this.meeting.createMeeting(b);
      await this.prisma.booking.update({ where: { id: b.id }, data: { meetingUrl: b.meetingUrl } });
    }
    const uid = await this.calDav.pushEvent({
      uid: `booking-${b.id}@schemalab.ru`,
      startsAt: b.startsAt,
      durationMin: b.durationMin,
      summary: `${sessionLabel(b.type)} — ${b.clientName}`,
      description: [b.clientContact, b.message, b.meetingUrl].filter(Boolean).join('\n'),
      location: b.meetingUrl ?? undefined,
    });
    if (uid) {
      await this.prisma.booking.update({ where: { id: b.id }, data: { calDavUid: uid } });
    }
    await this.sendAdmin('✅ <b>Запись подтверждена</b>', b);
  }

  /** Remove from Apple Calendar + notify admin when cancelled. */
  async onCancelled(b: PlainBooking, calDavUid: string | null): Promise<void> {
    if (calDavUid) await this.calDav.removeEvent(calDavUid);
    await this.sendAdmin('❌ <b>Запись отменена</b>', b);
  }

  /** Send confirmation/cancellation reminders. Runs every 5 minutes. */
  @Cron('*/5 * * * *')
  async sendReminders(): Promise<void> {
    const now = Date.now();
    await this.remindWindow(now + 24 * 3_600_000, 'reminder24SentAt', 'завтра');
    await this.remindWindow(now + 2 * 3_600_000, 'reminder2SentAt', 'через 2 часа');
  }

  private async remindWindow(beforeMs: number, field: 'reminder24SentAt' | 'reminder2SentAt', when: string) {
    const due = await this.prisma.booking.findMany({
      where: {
        status: BookingStatus.CONFIRMED,
        startsAt: { gt: new Date(), lte: new Date(beforeMs) },
        [field]: null,
      },
    });
    for (const row of due) {
      const b = decryptRecord(row, SCHEMA) as unknown as PlainBooking;
      await this.sendAdmin(`⏰ <b>Напоминание: сессия ${when}</b>`, b);
      await this.prisma.booking.update({ where: { id: b.id }, data: { [field]: new Date() } });
    }
    if (due.length) this.logger.log(`Sent ${due.length} ${field} reminder(s)`);
  }

  private async sendAdmin(title: string, b: PlainBooking): Promise<void> {
    const text = [
      title,
      '',
      `👤 ${b.clientName}`,
      `📬 ${b.clientContact}`,
      `🗓 ${formatTime(b.startsAt)}`,
      b.message ? `💬 ${b.message}` : null,
      b.meetingUrl ? `🔗 ${b.meetingUrl}` : null,
    ].filter(Boolean).join('\n');
    await this.telegram.notifyAdmin(text).catch(() => null);
  }
}

function formatTime(date: Date): string {
  return new Intl.DateTimeFormat('ru-RU', {
    timeZone: 'Europe/Moscow',
    weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit',
  }).format(date) + ' МСК';
}
