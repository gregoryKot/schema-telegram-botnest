import { Logger } from '@nestjs/common';
import { BotService, NEED_IDS } from '../bot/bot.service';
import { BotAnalyticsService } from '../bot/bot.analytics.service';
import { PairsService } from '../bot/pairs.service';
import {
  NotificationService,
  NotificationType,
} from '../notification/notification.service';
import { NotificationCadenceService } from '../notification/notification.cadence.service';
import { buildSummaryText } from '../notification/notification.templates';
import {
  localDateString,
  utcInstantForLocalHour,
} from '../notification/notification.time';
import { normalizeAddressForm } from '../notification/address-form';

// Что происходит после заполнения трекера: сводка дня, «с возвращением»
// после перерыва, вехи (серии/онбординг/годовщины) и мягкий сигнал
// напарнику. Вынесено из telegram.schedule.service.ts (правило №10).

export interface DiaryCompleteDeps {
  botService: BotService;
  analyticsService: BotAnalyticsService;
  pairsService: PairsService;
  notificationService: NotificationService;
  cadenceService: NotificationCadenceService;
  logger: Logger;
}

/**
 * Веха вида `<prefix>_<days>`: шлём один раз в жизни, ровно когда счётчик
 * совпал с порогом. Три семейства (серии, онбординг, годовщины) отличались
 * только префиксом и списком порогов — раньше это были три копии цикла.
 */
async function scheduleMilestone(
  deps: DiaryCompleteDeps,
  userId: bigint,
  prefix: 'streak' | 'onboarding' | 'anniversary',
  thresholds: readonly number[],
  actual: number,
): Promise<void> {
  for (const days of thresholds) {
    const type = `${prefix}_${days}` as NotificationType;
    if (
      actual === days &&
      !(await deps.notificationService.hasEver(userId, type))
    ) {
      await deps.notificationService.schedule(userId, type, new Date());
    }
  }
}

export async function runDiaryComplete(
  deps: DiaryCompleteDeps,
  userId: bigint,
) {
  await deps.notificationService.cancel(userId, 'reminder');
  await deps.notificationService.cancel(userId, 'pre_reminder');
  await deps.notificationService.cancel(userId, 'low_streak_insight');
  await deps.cadenceService.registerFill(userId);

  const settings = await deps.botService.getUserSettings(userId);
  const tz = settings?.notifyTimezone ?? 'Europe/Moscow';
  const notifyLocalHour = settings?.notifyLocalHour ?? 21;
  const ratings = await deps.botService.getRatings(userId);
  const text = buildSummaryText(
    deps.botService.getNeeds(),
    ratings,
    tz,
    normalizeAddressForm(settings?.addressForm),
  );

  await deps.notificationService.cancel(userId, 'summary');
  // Schedule summary after milestones: if notify hour passed, add 5 min so milestones (sent now)
  // arrive first and summary follows in the next processQueue cycle.
  const now = new Date();
  const todayStr = localDateString(tz, now);
  const todaySendAt = utcInstantForLocalHour(todayStr, notifyLocalHour, tz);
  const sendAt =
    todaySendAt > now ? todaySendAt : new Date(now.getTime() + 5 * 60_000);
  await deps.notificationService.schedule(userId, 'summary', sendAt, {
    text,
  });

  // 4.5 (аудит 2026-07): лёгкий социальный триггер для напарника — до
  // раннего return'а comeback-ветки, чтобы срабатывал в обоих путях.
  await maybeNotifyPairPartners(deps, userId).catch((err) =>
    deps.logger.error('maybeNotifyPairPartners failed', err),
  );

  const total = await deps.analyticsService.getTotalDaysFilled(userId);

  // Возвращение после перерыва ≥3 дней: тёплое «с возвращением» вместо вех —
  // одно празднование в день, без упоминания длины перерыва и сгоревших серий.
  const gap = await deps.analyticsService.getGapBeforeLatestFill(userId);
  if (gap !== null && gap >= 3) {
    const last = await deps.notificationService.lastSentAt(userId, 'comeback');
    const sentToday = last !== null && localDateString(tz, last) === todayStr;
    if (
      !sentToday &&
      !(await deps.notificationService.hasPending(userId, 'comeback'))
    ) {
      // Value-based возврат: добавляем зеркало собственных данных (сильнейшая потребность).
      const insight = await deps.analyticsService.getProfileInsight(userId);
      const strongestNeed = insight
        ? deps.botService.getNeeds().find((n) => n.id === insight.strongest)
            ?.chartLabel
        : undefined;
      await deps.notificationService.schedule(userId, 'comeback', new Date(), {
        totalDays: total,
        strongestNeed,
        strongestAvg: insight?.strongestAvg,
      });
    }
    return;
  }

  const streak = await deps.analyticsService.getConsecutiveDays(userId);
  await scheduleMilestone(deps, userId, 'streak', [7, 14, 30], streak);

  await scheduleMilestone(deps, userId, 'onboarding', [1, 3, 7], total);
  await scheduleMilestone(deps, userId, 'anniversary', [30, 60, 90], total);
}

// Парный триггер (аудит 2026-07, этап 4.5): юзер заполнил трекер — мягко
// подсказать активным напарникам. Ограничители: уведомления партнёра
// включены; партнёр сегодня ещё не заполнил сам; максимум один
// pair_activity в день (по его таймзоне); тихие часы/бюджет — через очередь.
export async function maybeNotifyPairPartners(
  deps: DiaryCompleteDeps,
  userId: bigint,
): Promise<void> {
  const pairs = await deps.pairsService.getUserPairs(userId);
  for (const pair of pairs) {
    if (pair.status !== 'active' || pair.partnerId === null) continue;
    const partnerId = BigInt(pair.partnerId);

    const settings = await deps.botService.getUserSettings(partnerId);
    if (!settings || settings.notifyEnabled === false) continue;

    // Напарник уже заполнил сегодня сам — подсказка не нужна.
    const partnerRatings = await deps.botService.getRatings(partnerId);
    if (NEED_IDS.every((id) => partnerRatings[id] !== undefined)) continue;

    const tz = settings.notifyTimezone ?? 'Europe/Moscow';
    const todayStr = localDateString(tz, new Date());
    const last = await deps.notificationService.lastSentAt(
      partnerId,
      'pair_activity',
    );
    const sentToday = last !== null && localDateString(tz, last) === todayStr;
    if (
      sentToday ||
      (await deps.notificationService.hasPending(partnerId, 'pair_activity'))
    ) {
      continue;
    }

    await deps.notificationService.schedule(
      partnerId,
      'pair_activity',
      new Date(),
    );
  }
}
