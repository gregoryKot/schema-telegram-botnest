import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { BookingStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { BookingNotifyService } from './booking-notify.service';
import { finishConfirmEffects } from './booking.confirm-effects';
import { CronLeaderService, LEASE_WINDOW } from '../infra/cron-leader.service';

/** Бронь «зависла», если с её последней записи прошло столько минут. */
export const STALLED_AFTER_MIN = 5;
/** Сколько броней добираем за тик (остальные — на следующем). */
const BATCH = 20;
/** Не чаще раза в столько мс пишем в лог об ошибке добора (не спам). */
const WARN_EVERY_MS = 30 * 60_000;

/**
 * Страховка от гибели процесса между CAS HELD→CONFIRMED и концом эффектов
 * (security#21): раз в 5 минут добирает CONFIRMED-брони с пустым
 * `confirmEffectsDoneAt` и будущим началом — ссылка, календарь, DM. Проход,
 * который ещё идёт, от добора отделяет возраст строки: его собственные записи
 * (`meetingUrl`, `calDavUid`) двигают `updatedAt`.
 */
@Injectable()
export class BookingConfirmRetryService {
  private readonly logger = new Logger(BookingConfirmRetryService.name);
  private lastWarnAt = 0;

  constructor(
    private readonly prisma: PrismaService,
    private readonly notify: BookingNotifyService,
    private readonly cronLeader: CronLeaderService,
  ) {}

  @Cron('*/5 * * * *')
  async retryStalled(): Promise<void> {
    // Без аренды два инстанса доделывают одну бронь одновременно.
    if (
      !(await this.cronLeader.claimRun(
        'bookingConfirmRetry',
        LEASE_WINDOW.fiveMinutes,
      ))
    )
      return;
    const now = Date.now();
    const rows = await this.prisma.booking.findMany({
      where: {
        status: BookingStatus.CONFIRMED,
        confirmEffectsDoneAt: null,
        startsAt: { gt: new Date(now) },
        updatedAt: { lt: new Date(now - STALLED_AFTER_MIN * 60_000) },
      },
      // Давно не тронутые первыми; упавшая бронь «освежается» ниже и уходит в хвост.
      orderBy: { updatedAt: 'asc' },
      take: BATCH,
    });
    let done = 0;
    let failed = 0;
    let lastError = '';
    for (const row of rows) {
      try {
        if (await finishConfirmEffects(this.notify, row)) done++;
      } catch (e) {
        failed++;
        lastError = `#${row.id}: ${(e as Error).message}`;
        // Отодвигаем упавшую в хвост очереди: двадцать вечно падающих броней
        // иначе занимали бы весь BATCH и не пускали остальных.
        try {
          await this.prisma.booking.update({
            where: { id: row.id },
            data: { updatedAt: new Date() },
          });
        } catch (touchErr) {
          // База недоступна — основной сбой уже в lastError и warn ниже.
          this.logger.debug(
            `Booking confirm retry: не удалось отодвинуть #${row.id}: ${(touchErr as Error).message}`,
          );
        }
      }
    }
    if (done) this.logger.log(`Booking confirm retry: finished ${done}`);
    if (failed && now - this.lastWarnAt >= WARN_EVERY_MS) {
      this.lastWarnAt = now;
      this.logger.warn(
        `Booking confirm retry: ${failed} of ${rows.length} still failing, last ${lastError}`,
      );
    }
  }
}
