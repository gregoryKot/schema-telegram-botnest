import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationService } from './notification.service';
import { BotAnalyticsService } from '../bot/bot.analytics.service';
import { addDaysLocal, localDateString } from './notification.time';
import {
  CADENCE_USER_SELECT,
  claimFillDay,
  claimPlanDay,
} from './notification.cadence-store';

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

  /** Захват дня плана под полуночный обход — notification.cadence-store.ts. */
  claimPlanDay(user: CadenceUser, now = new Date(), planDate?: string) {
    return claimPlanDay(this.prisma, user, now, planDate);
  }

  /** Захват дня заполнения трекера (E16) — notification.cadence-store.ts. */
  claimFillDay(userId: bigint, day: string) {
    return claimFillDay(this.prisma, userId, day);
  }

  /** 'paused' — пропустить юзера; 'expired' — пауза кончилась, отправить welcome_back и больше ничего */
  async expirePauseIfDue(
    user: CadenceUser,
    now = new Date(),
    planDate?: string,
  ): Promise<'none' | 'paused' | 'expired'> {
    if (!user.notifyPausedUntil) return 'none';
    if (user.notifyPausedUntil > now) return 'paused';
    const today = planDate ?? localDateString(user.notifyTimezone, now);
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
   * Полуночная оценка: игнор (по последнему завершённому местному дню), сдвиги
   * уровня, «день плана — день напоминания?» (planDate, E13 — шапка
   * планировщика). Идемпотентна по notifyLastEvalDate.
   */
  async evaluate(
    user: CadenceUser,
    now = new Date(),
    planDate?: string,
  ): Promise<{ remindToday: boolean }> {
    const tz = user.notifyTimezone;
    const today = planDate ?? localDateString(tz, now);
    if (user.notifyLastEvalDate === today) return { remindToday: false };
    const yesterday = addDaysLocal(localDateString(tz, now), -1);

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

  /** Дневник заполнен: не игнор; возвращает день следующего контакта (fill-cancel). */
  async registerFill(userId: bigint, now = new Date()): Promise<string | null> {
    const user = await this.loadUser(userId);
    if (!user) return null;
    const today = localDateString(user.notifyTimezone, now);
    const next = addDaysLocal(today, CADENCE_INTERVALS[effectiveLevel(user)]);
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        notifyIgnoredCount: 0,
        notifySkipAckDate: null,
        notifyNextRemindDate: next,
      },
    });
    return next;
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

  /**
   * Атомарно инкрементирует и возвращает счётчик отправленных напоминаний.
   * Один раз на каждое РЕАЛЬНО запланированное напоминание — nonce ротации
   * текста: соседние получают seq n и n+1, и variant = seq % N у них всегда
   * разный (ротация по календарному дню при фиксированном интервале повторялась).
   */
  async nextReminderSeq(userId: bigint): Promise<number> {
    const row = await this.prisma.user.update({
      where: { id: userId },
      data: { notifyReminderSeq: { increment: 1 } },
      select: { notifyReminderSeq: true },
    });
    return row.notifyReminderSeq;
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
      select: CADENCE_USER_SELECT,
    });
  }
}
