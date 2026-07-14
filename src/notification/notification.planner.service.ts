import { Injectable, Logger } from '@nestjs/common';
import { NotificationService } from './notification.service';
import {
  NotificationCadenceService,
  CadenceUser,
  effectiveLevel,
} from './notification.cadence.service';
import { BotService } from '../bot/bot.service';
import { BotAnalyticsService } from '../bot/bot.analytics.service';
import { PracticesService } from '../bot/practices.service';
import {
  buildWeeklySummaryText,
  renderLowStreakInsight,
} from './notification.templates';
import { addDaysLocal, localDateString, nextSendAt } from './notification.time';
import { normalizeAddressForm } from './address-form';

export interface PlannerUser extends CadenceUser {
  notifyLocalHour: number;
  notifyReminderEnabled: boolean;
  notifyGamified?: boolean;
  addressForm?: string | null;
}

/**
 * Дневной бюджет: максимум ОДНО проактивное уведомление на юзера в день.
 * Единственная точка решения — первый матч по приоритету, остальное молчит.
 * Реактивные (summary, comeback, вехи, терапевтские) бюджету не подчиняются.
 */
@Injectable()
export class NotificationPlannerService {
  private readonly logger = new Logger(NotificationPlannerService.name);

  constructor(
    private readonly notifications: NotificationService,
    private readonly cadence: NotificationCadenceService,
    private readonly botService: BotService,
    private readonly analytics: BotAnalyticsService,
    private readonly practicesService: PracticesService,
  ) {}

  async planDay(user: PlannerUser, now = new Date()) {
    const { id: uid, notifyLocalHour: hour, notifyTimezone: tz } = user;

    const pauseState = await this.cadence.expirePauseIfDue(user, now);
    if (pauseState === 'paused') return;
    if (pauseState === 'expired') {
      if (!(await this.notifications.hasPending(uid, 'welcome_back'))) {
        await this.notifications.schedule(
          uid,
          'welcome_back',
          nextSendAt(hour, tz, now),
        );
      }
      return;
    }

    // Оценка движка идёт каждую ночь — детекция игнора и сдвиги уровня не зависят
    // от того, какое сообщение (и было ли) отправлено сегодня.
    const { remindToday } = await this.cadence.evaluate(user, now);
    const level = effectiveLevel(user);
    const daysSince = await this.analytics.getDaysSinceLastFill(uid);

    // Перерывы: 3 → lapsing_3, 7 → dormant_7, 30 → reengagement_30, дальше nudge раз в 45 дней.
    // При уровне ≥2 короткие перерывы (3–7 дней) ожидаемы — движок уже отступил, это не «lapsing».
    const lapsingType =
      daysSince === 3 && level < 2
        ? 'lapsing_3'
        : daysSince === 7 && level < 2
          ? 'dormant_7'
          : daysSince === 30
            ? 'reengagement_30'
            : daysSince > 30 && (daysSince - 30) % 45 === 0
              ? 'nudge'
              : null;
    if (lapsingType) {
      if (!(await this.notifications.hasPending(uid, lapsingType))) {
        await this.notifications.cancel(uid, 'reminder');
        const payload = lapsingType === 'nudge' ? { daysSince } : undefined;
        await this.notifications.schedule(
          uid,
          lapsingType,
          nextSendAt(hour, tz, now),
          payload,
        );
      }
      return;
    }

    // День 14 без записей: возврат через зеркало СОБСТВЕННЫХ данных (value_recap).
    // Заполняет мёртвое окно между dormant_7 и reengagement_30. Только при значимом
    // портрете (≥5 дней истории) — иначе в этот день просто тишина.
    if (
      daysSince === 14 &&
      !(await this.notifications.hasPending(uid, 'value_recap'))
    ) {
      const insight = await this.analytics.getProfileInsight(uid);
      if (insight) {
        const needs = this.botService.getNeeds();
        const strongest = needs.find(
          (n) => n.id === insight.strongest,
        )?.chartLabel;
        const weakest = needs.find((n) => n.id === insight.weakest)?.chartLabel;
        await this.notifications.cancel(uid, 'reminder');
        await this.notifications.schedule(
          uid,
          'value_recap',
          nextSendAt(hour, tz, now),
          {
            totalDays: insight.totalDays,
            strongest,
            strongestAvg: insight.strongestAvg,
            weakest,
            weakestAvg: insight.weakestAvg,
          },
        );
      }
      return;
    }

    // Воскресенье (локальное) для активных: недельная сводка заменяет напоминание
    const today = localDateString(tz, now);
    const isSunday = new Date(`${today}T12:00:00Z`).getUTCDay() === 0;
    if (
      isSunday &&
      daysSince >= 0 &&
      daysSince < 7 &&
      !(await this.notifications.hasPending(uid, 'weekly'))
    ) {
      const stats = await this.analytics.getWeeklyStats(uid);
      const bestDay = await this.analytics.getBestDayOfWeek(uid);
      const text = buildWeeklySummaryText(
        stats,
        this.botService.getNeeds(),
        bestDay,
        Number(uid % 3n),
        normalizeAddressForm(user.addressForm),
      );
      await this.notifications.cancel(uid, 'reminder');
      await this.notifications.schedule(
        uid,
        'weekly',
        nextSendAt(hour, tz, now),
        { text },
      );
      return;
    }

    // 1-е число месяца (локальное): мягкое напоминание о донате активным.
    // totalDays → value-anchored формулировка для давних юзеров.
    if (
      today.endsWith('-01') &&
      daysSince >= 0 &&
      daysSince < 14 &&
      !(await this.notifications.hasPending(uid, 'donate_reminder'))
    ) {
      const totalDays = await this.analytics.getTotalDaysFilled(uid);
      await this.notifications.schedule(
        uid,
        'donate_reminder',
        nextSendAt(hour, tz, now),
        { seed: Number(uid % 3n), totalDays },
      );
      return;
    }

    if (remindToday && user.notifyReminderEnabled) {
      await this.scheduleReminder(uid, hour, tz, now, !!user.notifyGamified);
      return;
    }

    // Дни без напоминания: невыполненный вчерашний план или инсайт о низкой потребности
    const yesterday = addDaysLocal(today, -1);
    const missed = await this.practicesService.getMissedPlans(uid, yesterday);
    if (
      missed.length > 0 &&
      !(await this.notifications.hasPending(uid, 'practice_missed'))
    ) {
      const text = missed.map((p) => p.practiceText).join(', ');
      await this.notifications.schedule(
        uid,
        'practice_missed',
        nextSendAt(hour, tz, now),
        { practiceText: text },
      );
      return;
    }

    await this.scheduleLowStreakInsight(uid, hour, tz, now, user.addressForm);
  }

  /** Умное напоминание: вчерашний индекс + западающая потребность + серия.
   *  gamified=true добавляет позитивную срочность («ещё день до вехи»). */
  async scheduleReminder(
    userId: bigint,
    notifyLocalHour: number,
    tz: string,
    now = new Date(),
    gamified = false,
  ) {
    const [streak, weeklyStats, history] = await Promise.all([
      this.analytics.getConsecutiveDays(userId),
      this.analytics.getWeeklyStats(userId),
      this.analytics.getHistoryRatings(userId, 2),
    ]);
    const yesterday = history.find((_, i) => i === 1);
    const yesterdayAvg = yesterday
      ? Object.values(yesterday.ratings).reduce((s, v) => s + v, 0) /
        Object.values(yesterday.ratings).length
      : undefined;
    const lowest = weeklyStats
      .filter((s) => s.avg !== null)
      .sort((a, b) => (a.avg ?? 10) - (b.avg ?? 10))[0];
    const lowestNeed = lowest
      ? this.botService.getNeeds().find((n) => n.id === lowest.needId)
          ?.chartLabel
      : undefined;
    const dayIndex = Math.floor(now.getTime() / 86_400_000);
    // В игровом режиме подсвечиваем ближайшую веху: если завтра серия достигнет 7/14/30.
    const approachingStreak = gamified
      ? [7, 14, 30].find((m) => streak + 1 === m)
      : undefined;
    const payload = {
      streak,
      yesterdayAvg,
      lowestNeedId: lowest?.needId,
      lowestNeed,
      variant: Number((userId + BigInt(dayIndex)) % 5n),
      seed: Number((userId + BigInt(dayIndex)) % 3n),
      gamified,
      approachingStreak,
    };
    // Всегда отменяем зависшие напоминания и планируем заново
    await this.notifications.cancel(userId, 'reminder');
    await this.notifications.schedule(
      userId,
      'reminder',
      nextSendAt(notifyLocalHour, tz, now),
      payload,
    );
  }

  private async scheduleLowStreakInsight(
    userId: bigint,
    notifyLocalHour: number,
    tz: string,
    now: Date,
    addressForm?: string | null,
  ) {
    const [lowNeeds3, lowNeeds10] = await Promise.all([
      this.analytics.getLowStreakNeeds(userId, 5, 3),
      this.analytics.getLowStreakNeeds(userId, 5, 10),
    ]);
    const lowNeeds = lowNeeds10.length > 0 ? lowNeeds10 : lowNeeds3;
    if (lowNeeds.length === 0) return;
    if (await this.notifications.hasPending(userId, 'low_streak_insight'))
      return;

    const showBooking = lowNeeds10.length > 0;
    const need = this.botService.getNeeds().find((n) => n.id === lowNeeds[0])!;
    const { text } = renderLowStreakInsight(
      need.emoji,
      need.chartLabel,
      showBooking ? 10 : 3,
      normalizeAddressForm(addressForm),
    );
    await this.notifications.schedule(
      userId,
      'low_streak_insight',
      nextSendAt(notifyLocalHour, tz, now),
      { text, showBooking },
    );
  }
}
