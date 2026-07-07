import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationService } from './notification.service';
import { BotAnalyticsService } from '../bot/bot.analytics.service';
import { addDaysLocal, localDateString } from './notification.time';

/** Уровни частоты: 0=каждый день, 1=через день, 2=пара раз в неделю, 3=раз в неделю */
export const CADENCE_INTERVALS = [1, 2, 3, 7] as const;
export const CADENCE_LABELS = [
  'каждый день',
  'через день',
  'пару раз в неделю',
  'раз в неделю',
] as const;
export const MAX_CADENCE_LEVEL = 3;
/** Сколько подряд проигнорированных напоминаний ведут к снижению частоты */
const IGNORES_BEFORE_DOWNSHIFT = 3;

export interface CadenceUser {
  id: bigint;
  notifyTimezone: string;
  notifyFrequency: number;
  notifyAdaptiveLevel: number;
  notifyIgnoredCount: number;
  notifyNextRemindDate: string | null;
  notifySkipAckDate: string | null;
  notifyLastEvalDate: string | null;
  notifyPausedUntil: Date | null;
}

export function effectiveLevel(
  u: Pick<CadenceUser, 'notifyFrequency' | 'notifyAdaptiveLevel'>,
): number {
  return Math.min(
    MAX_CADENCE_LEVEL,
    Math.max(u.notifyFrequency, u.notifyAdaptiveLevel),
  );
}

/**
 * Адаптивный движок частоты напоминаний. Замечает игнорируемые напоминания и
 * тихо снижает частоту; при возвращении активности мягко поднимает обратно —
 * но никогда не пишет чаще, чем юзер выбрал сам (notifyFrequency — потолок).
 */
@Injectable()
export class NotificationCadenceService {
  private readonly logger = new Logger(NotificationCadenceService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationService,
    private readonly analytics: BotAnalyticsService,
  ) {}

  /** 'paused' — пропустить юзера; 'expired' — пауза кончилась, отправить welcome_back и больше ничего */
  async expirePauseIfDue(
    user: CadenceUser,
    now = new Date(),
  ): Promise<'none' | 'paused' | 'expired'> {
    if (!user.notifyPausedUntil) return 'none';
    if (user.notifyPausedUntil > now) return 'paused';
    const today = localDateString(user.notifyTimezone, now);
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        notifyPausedUntil: null,
        notifyIgnoredCount: 0,
        notifySkipAckDate: null,
        notifyLastEvalDate: today,
        notifyNextRemindDate: addDaysLocal(
          today,
          CADENCE_INTERVALS[effectiveLevel(user)],
        ),
      },
    });
    return 'expired';
  }

  /**
   * Полуночная оценка: детекция игнора, сдвиги уровня, решение «сегодня день напоминания?».
   * Идемпотентна в пределах локального дня (notifyLastEvalDate) — catch-up при
   * рестарте не накрутит счётчик второй раз.
   */
  async evaluate(
    user: CadenceUser,
    now = new Date(),
  ): Promise<{ remindToday: boolean }> {
    const tz = user.notifyTimezone;
    const today = localDateString(tz, now);
    if (user.notifyLastEvalDate === today) return { remindToday: false };
    const yesterday = addDaysLocal(today, -1);

    let ignored = user.notifyIgnoredCount;
    let adaptive = user.notifyAdaptiveLevel;

    const lastReminder = await this.notifications.lastSentAt(
      user.id,
      'reminder',
    );
    if (lastReminder && localDateString(tz, lastReminder) === yesterday) {
      const daysSince = await this.analytics.getDaysSinceLastFill(user.id);
      const filledYesterday = daysSince >= 0 && daysSince <= 1;
      if (!filledYesterday && user.notifySkipAckDate !== yesterday) ignored++;
    }

    if (ignored >= IGNORES_BEFORE_DOWNSHIFT) {
      adaptive = Math.min(
        MAX_CADENCE_LEVEL,
        Math.max(user.notifyFrequency, adaptive) + 1,
      );
      ignored = 0;
      this.logger.log(
        `Cadence downshift userId=${user.id} → level ${adaptive}`,
      );
    } else if (adaptive > user.notifyFrequency) {
      const fills = await this.analytics.getFillDaysInLast(user.id, 7);
      if (fills >= 2) adaptive--;
    }

    const effective = Math.min(
      MAX_CADENCE_LEVEL,
      Math.max(user.notifyFrequency, adaptive),
    );
    const remindToday =
      !user.notifyNextRemindDate || today >= user.notifyNextRemindDate;
    const nextRemindDate = remindToday
      ? addDaysLocal(today, CADENCE_INTERVALS[effective])
      : user.notifyNextRemindDate;

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        notifyIgnoredCount: ignored,
        notifyAdaptiveLevel: adaptive,
        notifyNextRemindDate: nextRemindDate,
        notifyLastEvalDate: today,
      },
    });
    return { remindToday };
  }

  /** Дневник заполнен: не игнор, следующий контакт через полный интервал. Идемпотентно за день. */
  async registerFill(userId: bigint, now = new Date()) {
    const user = await this.loadUser(userId);
    if (!user) return;
    const today = localDateString(user.notifyTimezone, now);
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        notifyIgnoredCount: 0,
        notifySkipAckDate: null,
        notifyNextRemindDate: addDaysLocal(
          today,
          CADENCE_INTERVALS[effectiveLevel(user)],
        ),
      },
    });
  }

  /** «Сегодня не могу»: день выведен из подсчёта игноров, без последствий. */
  async skipToday(userId: bigint, now = new Date()) {
    const user = await this.loadUser(userId);
    if (!user) return;
    const today = localDateString(user.notifyTimezone, now);
    await this.prisma.user.update({
      where: { id: userId },
      data: { notifySkipAckDate: today },
    });
    await this.notifications.cancel(userId, 'pre_reminder');
  }

  /** «Реже»: явный выбор юзера — ступень вниз, адаптация сбрасывается на неё же. */
  async slower(userId: bigint, now = new Date()): Promise<number> {
    const user = await this.loadUser(userId);
    if (!user) return 0;
    const newLevel = Math.min(MAX_CADENCE_LEVEL, effectiveLevel(user) + 1);
    const today = localDateString(user.notifyTimezone, now);
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        notifyFrequency: newLevel,
        notifyAdaptiveLevel: newLevel,
        notifyIgnoredCount: 0,
        notifyNextRemindDate: addDaysLocal(today, CADENCE_INTERVALS[newLevel]),
      },
    });
    await this.notifications.cancel(userId, 'pre_reminder');
    return newLevel;
  }

  /** Пауза на N дней: проактивные уведомления отменяются, терапевтские и summary остаются. */
  async pause(userId: bigint, days: number, now = new Date()): Promise<Date> {
    const until = new Date(now.getTime() + days * 86_400_000);
    await this.prisma.user.update({
      where: { id: userId },
      data: { notifyPausedUntil: until },
    });
    await this.notifications.cancelProactive(userId);
    return until;
  }

  private loadUser(userId: bigint): Promise<CadenceUser | null> {
    return this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        notifyTimezone: true,
        notifyFrequency: true,
        notifyAdaptiveLevel: true,
        notifyIgnoredCount: true,
        notifyNextRemindDate: true,
        notifySkipAckDate: true,
        notifyLastEvalDate: true,
        notifyPausedUntil: true,
      },
    });
  }
}
