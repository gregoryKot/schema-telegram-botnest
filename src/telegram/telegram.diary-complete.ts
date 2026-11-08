import { Logger } from '@nestjs/common';
import { BotService } from '../bot/bot.service';
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
import { cancelOnFill } from '../notification/notification.fill-cancel';
import { maybeNotifyPairPartners } from './telegram.pair-activity';
export { maybeNotifyPairPartners } from './telegram.pair-activity';

// Что происходит после заполнения трекера: сводка дня, «с возвращением»
// после перерыва, вехи (серии/онбординг/годовщины) и мягкий сигнал
// напарнику. Вынесено из telegram.schedule.service.ts (правило №10).
// R2 (аудит 2026-11, решение владельца Р1): сводка, вехи и «с возвращением»
// слушаются тумблера «Итоги дня» (notifySummaryEnabled), напоминания —
// «Напоминаний» (notifyEnabled, планировщик). Раньше итоги приходили всегда.

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
  now = new Date(),
) {
  const nextContact = await deps.cadenceService.registerFill(userId, now);
  const settings = await deps.botService.getUserSettings(userId);
  const tz = settings?.notifyTimezone ?? 'Europe/Moscow';
  // Напоминания до дня следующего контакта и все «давно не заходил» (R4, E13).
  await cancelOnFill(deps.notificationService, userId, tz, now, nextContact);
  await deps.notificationService.cancel(userId, 'summary');

  // 4.5 (аудит 2026-07): лёгкий социальный триггер для напарника — до
  // ранних return'ов (итоги выключены, comeback), чтобы срабатывал всегда.
  await maybeNotifyPairPartners(deps, userId, now).catch((err) =>
    deps.logger.error('maybeNotifyPairPartners failed', err),
  );
  if (settings?.notifySummaryEnabled === false) return;

  const ratings = await deps.botService.getRatings(userId);
  const text = buildSummaryText(
    deps.botService.getNeeds(),
    ratings,
    tz,
    normalizeAddressForm(settings?.addressForm),
  );
  // Schedule summary after milestones: if notify hour passed, add 5 min so milestones (sent now)
  // arrive first and summary follows in the next processQueue cycle.
  const todayStr = localDateString(tz, now);
  const hour = settings?.notifyLocalHour ?? 21;
  const todaySendAt = utcInstantForLocalHour(todayStr, hour, tz);
  const sendAt =
    todaySendAt > now ? todaySendAt : new Date(now.getTime() + 5 * 60_000);
  await deps.notificationService.schedule(userId, 'summary', sendAt, { text });

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
      await deps.notificationService.schedule(userId, 'comeback', now, {
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
