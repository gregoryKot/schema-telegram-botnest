import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { TelegramService } from '../telegram/telegram.service';
import { CalDavService } from './caldav.service';
import { MeetingService } from './meeting.service';
import { EmailService } from '../auth/email.service';
import { awaitingPaymentTitle, cancelledNotice } from './booking-admin-note';
import { subjectFromTitle } from './booking-notify.format';
import { bookingNotice } from './booking-owner-card';
import {
  errorKind,
  noticeChannels,
  type OwnerNotice,
} from '../utils/owner-card';
import type { PriceFields } from './booking-notify.price';
import { SessionType } from '@prisma/client';
import { CronLeaderService, LEASE_WINDOW } from '../infra/cron-leader.service';
import { runConfirmEffects } from './booking-confirm-run';
import { remindWindow } from './booking-reminders';

export interface PlainBooking extends PriceFields {
  id: number;
  startsAt: Date;
  durationMin: number;
  type: SessionType;
  clientName: string;
  clientContact: string;
  clientChannel?: string | null;
  message: string | null;
  meetingUrl: string | null;
  cancelToken: string;
  source?: string | null; // атрибуция лида (страница + referrer), хранится открыто
  clientTimeZone?: string | null;
  /** Событие в календаре уже создано (строка брони) — повторно не пушим. */
  calDavUid?: string | null;
  /** Эффекты подтверждения доведены до конца — onConfirmed ничего не делает. */
  confirmEffectsDoneAt?: Date | null;
  /** Ссылку этой брони дала заменённая комната клиента — повтор DM скажет об этом. */
  roomReplacedAt?: Date | null;
}

/** All side-effects of the booking lifecycle: Telegram, CalDAV, reminders. */
@Injectable()
export class BookingNotifyService {
  private readonly logger = new Logger(BookingNotifyService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly telegram: TelegramService,
    private readonly calDav: CalDavService,
    private readonly meeting: MeetingService,
    private readonly email: EmailService,
    private readonly cronLeader: CronLeaderService,
  ) {}

  /** On confirmation: meeting link + Apple Calendar + admin notify (идемпотентно, см. booking-confirm-run.ts). */
  async onConfirmed(b: PlainBooking): Promise<void> {
    await runConfirmEffects(
      {
        prisma: this.prisma,
        meeting: this.meeting,
        calDav: this.calDav,
        notifyAdminBoth: (html, subject) => this.notifyAdminBoth(html, subject),
      },
      b,
    );
  }

  /** Remove from Apple Calendar + notify admin when cancelled (оплаченная — «нужен возврат»). */
  async onCancelled(b: PlainBooking, calDavUid: string | null): Promise<void> {
    if (calDavUid) await this.calDav.removeEvent(calDavUid);
    const { html, subject } = cancelledNotice(b);
    await this.notifyAdminBoth(html, subject);
  }

  /** Notify admin a paid slot is reserved and awaiting payment (so a failed/abandoned payment isn't lost). */
  async onAwaitingPayment(b: PlainBooking, note?: string): Promise<void> {
    await this.sendAdmin(awaitingPaymentTitle(note), b);
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
    // админ получает два одинаковых DM (захват строки — booking-reminders.ts).
    if (
      !(await this.cronLeader.claimRun(
        'bookingReminders',
        LEASE_WINDOW.fiveMinutes,
      ))
    )
      return;
    const deps = {
      prisma: this.prisma,
      logger: this.logger,
      sendAdmin: (title: string, b: PlainBooking) => this.sendAdmin(title, b),
    };
    const now = Date.now();
    const H = 3_600_000;
    await remindWindow(deps, now + 24 * H, 'reminder24SentAt', 'завтра');
    await remindWindow(deps, now + 2 * H, 'reminder2SentAt', 'через 2 часа');
  }

  private async sendAdmin(title: string, b: PlainBooking): Promise<void> {
    const subject = subjectFromTitle(title);
    await this.notifyAdminBoth(bookingNotice(title, b), subject);
  }

  /** События брони — оба канала всегда; Telegram без данных человека, они в письме: его потеря — error. */
  async notifyAdminBoth(
    text: string | OwnerNotice,
    subject: string,
  ): Promise<void> {
    const { telegram, email } = noticeChannels(text);
    const plain = email.replace(/<[^>]+>/g, '');
    const [, mailed] = await Promise.all([
      this.telegram.notifyAdmin(telegram),
      this.email.sendAdminNotification(subject, plain).catch(errorKind),
    ]);
    if (mailed !== true)
      this.logger.error(`Admin e-mail not delivered: ${subject} (${mailed})`);
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
