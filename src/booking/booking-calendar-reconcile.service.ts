import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { BookingStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CronLeaderService, LEASE_WINDOW } from '../infra/cron-leader.service';
import { CalDavService } from './caldav.service';
import { cancelEventUid } from './booking.transitions';

/** Глубина сверки: брони, отменённые за столько мс (CAS отмены двигает `updatedAt`). */
export const RECONCILE_LOOKBACK_MS = 24 * 3_600_000;

/**
 * Сверка календаря владельца с отменами. Отмена шлёт в iCloud один DELETE, а
 * PUT подтверждения, оборванный гибелью пода, может дойти ПОСЛЕ него и вернуть
 * событие: слот выглядит занятым, владелец видит несуществующую сессию. CAS
 * здесь бессилен — запрос уже в сети. Поэтому раз в 15 минут DELETE
 * повторяется по каждой брони, отменённой за сутки: uid — тот же, что у отмены
 * (`cancelEventUid`), «события нет» (404/410) — успех, повтор безопасен. Тот
 * же проход добирает DELETE отмены, упавший на сбое сети.
 */
@Injectable()
export class BookingCalendarReconcileService {
  private readonly logger = new Logger(BookingCalendarReconcileService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly calDav: CalDavService,
    private readonly cronLeader: CronLeaderService,
  ) {}

  @Cron('*/15 * * * *')
  async reconcileCancelled(): Promise<void> {
    // Без iCloud снимать нечего: аренду не берём (правило №17).
    if (!this.calDav.enabled) return;
    // Без аренды каждый DELETE уходит в iCloud с каждого инстанса.
    if (
      !(await this.cronLeader.claimRun(
        'bookingCalendarReconcile',
        LEASE_WINDOW.fifteenMinutes,
      ))
    )
      return;
    const rows = await this.prisma.booking.findMany({
      where: {
        status: BookingStatus.CANCELLED,
        updatedAt: { gte: new Date(Date.now() - RECONCILE_LOOKBACK_MS) },
      },
      select: {
        id: true,
        status: true,
        calDavUid: true,
        paidAt: true,
        meetingUrl: true,
      },
    });
    const removed: number[] = [];
    for (const row of rows) {
      // Снимка «до отмены» нет, но PUT уходит только после записи meetingUrl:
      // свежей строки хватает, чтобы знать, могло ли событие появиться.
      const uid = cancelEventUid(row, row);
      if (uid && (await this.calDav.removeEvent(uid)) === 'deleted')
        removed.push(row.id);
    }
    // Ошибки DELETE пишет CalDavService; следующий тик повторит их сам.
    if (removed.length)
      this.logger.warn(
        `Booking calendar reconcile: removed events of cancelled bookings ${removed.map((id) => `#${id}`).join(', ')}`,
      );
  }
}
