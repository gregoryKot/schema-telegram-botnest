// Сводка недели и «вчерашний план» по местному дню плана человека (хвост
// волны 3, шапка notification.planner.service.ts).
//
// Обход один, в 00:00 UTC. У Владивостока (+10) это 10:00 субботы, а день
// плана — воскресенье: сводка собиралась в субботу утром без субботнего
// вечера, а «вчерашний план» в воскресном сообщении был пятничным. Теперь:
//   - окно сводки кончается днём плана (Москве — то же, что и раньше), а
//     заполнение в день перед днём плана освежает уже стоящую сводку
//     (refreshWeeklyOnFill, зовётся из telegram.diary-complete.ts);
//   - план берётся за последний завершённый местный день (суббота у
//     Владивостока к обходу ещё идёт — её исхода нет), но называется своим
//     днём: «Вчера» только если он и правда вчерашний для дня отправки,
//     иначе «План на пятницу».
import type { Logger } from '@nestjs/common';
import type { BotAnalyticsService } from '../bot/bot.analytics.service';
import type { BotService } from '../bot/bot.service';
import { normalizeAddressForm } from './address-form';
import type { NotificationService } from './notification.service';
import { buildWeeklySummaryText } from './notification.templates';
import { addDaysLocal } from './notification.time';

export interface WeeklyDeps {
  analytics: Pick<BotAnalyticsService, 'getWeeklyStats' | 'getBestDayOfWeek'>;
  botService: Pick<BotService, 'getNeeds'>;
}

const weekday = (date: string) => new Date(`${date}T12:00:00Z`).getUTCDay();

/** Текст сводки недели, которая кончается днём плана `planDate`. */
export async function weeklyPayload(
  deps: WeeklyDeps,
  uid: bigint,
  tz: string,
  planDate: string,
  form: string | null | undefined,
): Promise<{ text: string }> {
  const stats = await deps.analytics.getWeeklyStats(uid, tz, planDate);
  const bestDay = await deps.analytics.getBestDayOfWeek(uid);
  const needs = deps.botService.getNeeds();
  const f = normalizeAddressForm(form);
  return {
    text: buildWeeklySummaryText(stats, needs, bestDay, Number(uid % 3n), f),
  };
}

export interface WeeklyFillDeps {
  analyticsService: WeeklyDeps['analytics'];
  botService: WeeklyDeps['botService'];
  notificationService: Pick<
    NotificationService,
    'hasPending' | 'refreshPending'
  >;
  logger: Pick<Logger, 'error'>;
}

/**
 * Заполнение в субботу (местную) при стоящей сводке на воскресенье — освежить
 * её текст: обход собрал её раньше, чем кончилась суббота. В сам день плана
 * не трогаем — Москве обход собирает сводку в воскресенье ночью, как раньше.
 * Сбой не мешает остальному после заполнения — только строка в лог.
 */
export async function refreshWeeklyOnFill(
  d: WeeklyFillDeps,
  uid: bigint,
  tz: string,
  today: string,
  form: string | null | undefined,
): Promise<void> {
  const planDate = addDaysLocal(today, 1);
  if (weekday(planDate) !== 0) return;
  try {
    if (!(await d.notificationService.hasPending(uid, 'weekly'))) return;
    const deps = { analytics: d.analyticsService, botService: d.botService };
    const payload = await weeklyPayload(deps, uid, tz, planDate, form);
    await d.notificationService.refreshPending(uid, 'weekly', payload);
  } catch (err) {
    d.logger.error('refreshWeeklyOnFill failed', err);
  }
}

const ON_WEEKDAY = [
  'на воскресенье',
  'на понедельник',
  'на вторник',
  'на среду',
  'на четверг',
  'на пятницу',
  'на субботу',
];

/**
 * Как назвать день невыполненного плана в сообщении, которое уйдёт в день
 * `planDate`: накануне — шаблон скажет «Вчера был план» сам (undefined),
 * раньше — «План на пятницу».
 */
export function missedPlanDay(
  date: string,
  planDate: string,
): string | undefined {
  if (addDaysLocal(planDate, -1) === date) return undefined;
  return ON_WEEKDAY[weekday(date)];
}
