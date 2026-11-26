import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import type { Telegraf, Context } from 'telegraf';
import { PrismaService } from '../prisma/prisma.service';
import { AnalyticsService } from '../analytics/analytics.service';
import { CronLeaderService, LEASE_WINDOW } from '../infra/cron-leader.service';
import { TELEGRAF_BOT } from '../telegram/telegram.constants';
import { NotificationService } from './notification.service';
import { pickWeeklyRepeat } from './weekly-repeat';

const WEEK_MS = 7 * 86_400_000;
const BATCH = 200;

// «Повторы недели»: по понедельникам — что чаще всего повторялось за 7 дней.
// В очередь уходит только {kind, key, count}; текст собирается при отправке
// и зависит от канала (weekly-repeat.template.ts, РКН #1135).
@Injectable()
export class WeeklyRepeatScheduler {
  private readonly logger = new Logger(WeeklyRepeatScheduler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationService,
    private readonly cronLeader: CronLeaderService,
    @Inject(TELEGRAF_BOT)
    @Optional()
    private readonly bot: Telegraf<Context> | null,
    @Optional() private readonly analytics?: AnalyticsService,
  ) {}

  @Cron('23 9 * * 1')
  async run(): Promise<void> {
    // Очередь не разбирается без бота — захват аренды отнял бы тик у рабочего инстанса.
    if (!this.bot) return;
    const now = new Date();
    if (
      !(await this.cronLeader.claimRun(
        'weeklyRepeatDigest',
        LEASE_WINDOW.daily,
        now,
      ))
    ) {
      this.logger.log('weeklyRepeatDigest: аренду уже взял другой инстанс');
      return;
    }
    try {
      await this.walk(now);
    } catch (err) {
      this.logger.error('weeklyRepeatDigest failed', err as Error);
    }
  }

  private async walk(now: Date): Promise<void> {
    const since = new Date(now.getTime() - WEEK_MS);
    const sinceDate = since.toISOString().slice(0, 10);
    let after: bigint | undefined;
    for (;;) {
      const users = await this.prisma.user.findMany({
        where: {
          deletedAt: null,
          notifyEnabled: true,
          notifyWeeklyRepeatEnabled: true,
          ...(after !== undefined && { id: { gt: after } }),
          OR: [
            { modeDiaries: { some: { createdAt: { gte: since } } } },
            { ratings: { some: { date: { gte: sinceDate } } } },
          ],
        },
        select: { id: true },
        orderBy: { id: 'asc' },
        take: BATCH,
      });
      if (users.length === 0) return;
      after = users[users.length - 1].id;
      const userId = { in: users.map((u) => u.id) };
      const [modes, ratings] = await Promise.all([
        this.prisma.modeDiaryEntry.findMany({
          where: { userId, createdAt: { gte: since } },
          select: { userId: true, modeId: true, createdAt: true },
        }),
        this.prisma.rating.findMany({
          where: { userId, date: { gte: sinceDate } },
          select: { userId: true, needId: true, date: true, value: true },
        }),
      ]);
      for (const { id } of users) {
        await this.enqueue(
          id,
          now,
          modes.filter((m) => m.userId === id),
          ratings.filter((r) => r.userId === id),
        );
      }
    }
  }

  private async enqueue(
    userId: bigint,
    now: Date,
    modes: Parameters<typeof pickWeeklyRepeat>[0],
    ratings: Parameters<typeof pickWeeklyRepeat>[1],
  ): Promise<void> {
    try {
      const repeat = pickWeeklyRepeat(modes, ratings);
      if (!repeat) return;
      if (await this.notifications.hasPending(userId, 'weekly_repeat')) return;
      await this.notifications.schedule(userId, 'weekly_repeat', now, repeat);
      await this.analytics?.track(userId, 'weekly_repeat_sent', {
        kind: repeat.kind,
      });
    } catch (err) {
      this.logger.error(
        `weeklyRepeatDigest user=${userId} failed`,
        err as Error,
      );
    }
  }
}
