import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { TelegramService } from '../telegram/telegram.service';
import { CalDavService } from './caldav.service';
import { MeetingService } from './meeting.service';
import { EmailService } from '../auth/email.service';
import { decryptRecord, EncryptSchema } from '../utils/crypto';
import { sessionLabel } from './caldav-event.util';
import {
  bookingCardText,
  formatTime,
  subjectFromTitle,
} from './booking-notify.format';
import { BookingStatus, SessionType } from '@prisma/client';
import { CronLeaderService, LEASE_WINDOW } from '../infra/cron-leader.service';

const SCHEMA: EncryptSchema = {
  strings: ['clientName', 'clientContact', 'message'],
};

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
  /** Атрибуция лида (страница + referrer), хранится открыто. */
  source?: string | null;
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
    private readonly email: EmailService,
    config: ConfigService,
    private readonly cronLeader: CronLeaderService,
  ) {
    this.siteUrl = (
      config.get<string>('SITE_URL') ?? 'https://kotlarewski.gr'
    ).replace(/\/$/, '');
  }

  /** On confirmation: meeting link + Apple Calendar + admin notify. Mutates b.meetingUrl. */
  async onConfirmed(b: PlainBooking): Promise<void> {
    if (!b.meetingUrl) {
      b.meetingUrl = await this.meeting.createMeeting(b);
      await this.prisma.booking.update({
        where: { id: b.id },
        data: { meetingUrl: b.meetingUrl },
      });
    }
    const uid = await this.calDav.pushEvent({
      uid: `booking-${b.id}@schemehappens.ru`,
      startsAt: b.startsAt,
      durationMin: b.durationMin,
      summary: `${sessionLabel(b.type)} — ${b.clientName}`,
      description: [b.clientContact, b.message, b.meetingUrl]
        .filter(Boolean)
        .join('\n'),
      location: b.meetingUrl ?? undefined,
    });
    if (uid) {
      await this.prisma.booking.update({
        where: { id: b.id },
        data: { calDavUid: uid },
      });
    }
    await this.sendAdmin('✅ <b>Запись подтверждена</b>', b);
    // CalDAV настроен, но запись не удалась — тоже событие брони: оба канала.
    if (this.calDav.enabled && !uid) {
      const title = '⚠ <b>Подтверждена, но НЕ попала в Apple Calendar</b>';
      await this.notifyAdminBoth(
        `${title}\n${formatTime(b.startsAt)} · ${b.clientName}\nДобавьте в календарь вручную.`,
        subjectFromTitle(title),
      );
    }
  }

  /** Remove from Apple Calendar + notify admin when cancelled. */
  async onCancelled(b: PlainBooking, calDavUid: string | null): Promise<void> {
    if (calDavUid) await this.calDav.removeEvent(calDavUid);
    await this.sendAdmin('❌ <b>Запись отменена</b>', b);
  }

  /** Notify admin a paid slot is reserved and awaiting payment (so a failed/abandoned payment isn't lost). */
  async onAwaitingPayment(b: PlainBooking): Promise<void> {
    await this.sendAdmin(
      '⏳ <b>Бронь ожидает оплаты</b> (слот зарезервирован на 15 мин)',
      b,
    );
  }

  /** Notify admin that HELD bookings expired without payment (so they're not lost silently). */
  async notifyExpired(bookings: PlainBooking[]): Promise<void> {
    for (const b of bookings) {
      await this.sendAdmin('⌛ <b>Бронь истекла без оплаты</b>', b);
    }
  }

  /** Generic critical alert to admin (Telegram, with e-mail fallback). */
  async alertAdmin(text: string): Promise<void> {
    await this.notifyAdminText(text);
  }

  /** Send confirmation/cancellation reminders. Runs every 5 minutes. */
  @Cron('*/5 * * * *')
  async sendReminders(): Promise<void> {
    // Без аренды второй инстанс шлёт то же напоминание о сессии второй раз —
    // клиент получает два одинаковых DM.
    if (
      !(await this.cronLeader.claimRun(
        'bookingReminders',
        LEASE_WINDOW.fiveMinutes,
      ))
    )
      return;
    const now = Date.now();
    await this.remindWindow(now + 24 * 3_600_000, 'reminder24SentAt', 'завтра');
    await this.remindWindow(
      now + 2 * 3_600_000,
      'reminder2SentAt',
      'через 2 часа',
    );
  }

  private async remindWindow(
    beforeMs: number,
    field: 'reminder24SentAt' | 'reminder2SentAt',
    when: string,
  ) {
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
      await this.prisma.booking.update({
        where: { id: b.id },
        data: { [field]: new Date() },
      });
    }
    if (due.length) this.logger.log(`Sent ${due.length} ${field} reminder(s)`);
  }

  // Разделение (2026-09-15): события брони — оба канала всегда (деньги/
  // заявки); alertAdmin — Telegram-first, почта как запасной ход.
  private async sendAdmin(title: string, b: PlainBooking): Promise<void> {
    const subject = subjectFromTitle(title);
    await this.notifyAdminBoth(bookingCardText(title, b), subject);
  }

  /** Событие брони или потерянный лид — оба канала сразу, независимо от исхода Telegram. */
  async notifyAdminBoth(html: string, subject: string): Promise<void> {
    const plain = html.replace(/<[^>]+>/g, '');
    await Promise.all([
      this.telegram.notifyAdmin(html),
      this.email
        .sendAdminNotification(subject, plain)
        .catch((e) => this.logger.error('Critical admin e-mail failed', e)),
    ]);
  }

  /** Send to admin via Telegram; if that fails, fall back to e-mail so alerts are never lost. */
  private async notifyAdminText(html: string): Promise<void> {
    const ok = await this.telegram.notifyAdmin(html);
    if (ok) return;
    this.logger.warn('Admin Telegram notify failed — falling back to e-mail');
    const plain = html.replace(/<[^>]+>/g, '');
    await this.email
      .sendAdminNotification('Уведомление о записи', plain)
      .catch((e) => this.logger.error('Admin e-mail alert also failed', e));
  }
}
