// Горячие пути, у которых меряется план. Состав — из аудита (D-4 в
// docs/archive/PROJECT_AUDIT_ADDENDUM.md: «первый кандидат в узкое место») и
// из перечня владельца: клиенты терапевта, история трекера, отчёт /stats.
//
// Сценарий — это вызов РЕАЛЬНОГО сервиса, а не SQL-строка: что именно уйдёт в
// базу, решает код прода, и записывается это драйвером (record-sql.ts). Так
// новый запрос внутри уже измеряемого пути попадает под гейт сам, без того
// чтобы кто-то вспомнил его зарегистрировать.
import { BotAdminStatsService } from '../../src/bot/bot.admin-stats.service';
import { BLOCK_FAILED_MARK } from '../../src/bot/stats-settle';
import { BotAnalyticsService } from '../../src/bot/bot.analytics.service';
import { BotClientOverviewService } from '../../src/bot/bot.client-overview.service';
import { TherapyRelationsService } from '../../src/therapy/therapy-relations.service';
import { getFormerTherapistInfo } from '../../src/therapy/former-therapist-info';
import { NotificationService } from '../../src/notification/notification.service';
import { proactiveBudgetSpent } from '../../src/notification/notification.budget';
import { buildStatsReport } from '../e2e-support/stats-report.factory';
import type { ScenarioContext } from './worst-case-ids';

export { resolveWorstCaseIds, type ScenarioContext } from './worst-case-ids';

export interface Scenario {
  name: string;
  title: string;
  run: (ctx: ScenarioContext) => Promise<unknown>;
}

export const SCENARIOS: Scenario[] = [
  {
    name: 'stats-report',
    title: 'Админский отчёт /stats (оба сообщения команды)',
    // Ровно то, что делает команда /stats в telegram.admin.service.ts: ядро
    // отчёта и продуктовый блок считаются параллельно.
    run: async ({ prisma }) => {
      const texts = await Promise.all([
        new BotAdminStatsService(prisma).getAdminStats(),
        buildStatsReport(prisma).render(),
      ]);
      // render() не бросает при упавшем блоке (stats-settle.ts), а подставляет
      // заглушку; без этой проверки сломанный запрос тихо выпал бы из замера.
      if (texts.some((t) => t.includes(BLOCK_FAILED_MARK))) {
        throw new Error('stats-report: блок отчёта не посчитался');
      }
      return texts;
    },
  },
  {
    name: 'therapist-clients',
    title: 'Список клиентов терапевта (GET /api/therapy/clients)',
    run: ({ prisma, therapistId }) =>
      new TherapyRelationsService(
        prisma,
        new BotClientOverviewService(prisma),
      ).getClients(therapistId),
  },
  // 30 — экран истории; 365 — лента «Записи», потолок HISTORY_MAX_DAYS.
  ...[30, 365].map((days) => ({
    name: `history-${days}d`,
    title: `История трекера за ${days} дн. (GET /api/history?days=${days})`,
    run: ({ prisma, heavyUserId }: ScenarioContext) =>
      new BotAnalyticsService(prisma).getHistoryRatings(heavyUserId, days),
  })),
  {
    name: 'former-therapist',
    title: 'Бывший терапевт клиента (GET /api/therapy/former-therapist)',
    // Уходит при каждом открытии профиля сайта у клиента без терапевта. Связей
    // `ended` в синтетике нет (docs/open/therapy.md) — меряется частый путь.
    run: ({ prisma, unattachedUserId }) =>
      getFormerTherapistInfo(prisma, unattachedUserId),
  },
  {
    name: 'proactive-budget',
    title: 'Дневной бюджет проактивных (pair_activity: постановка и очередь)',
    // Оба входа proactiveBudgetSpent: постановка парного (telegram.pair-activity.ts,
    // без exceptId) и проверка строки очереди перед отправкой
    // (telegram.schedule-queue.gate.ts — на каждой строке pair_activity в тике,
    // exceptId — сама строка). День — у человека с самой длинной очередью.
    run: async ({ prisma, notifiedUserId }) => {
      const notifications = new NotificationService(prisma);
      const now = new Date();
      const tz = 'Europe/Moscow';
      return [
        await proactiveBudgetSpent(notifications, notifiedUserId, tz, now),
        await proactiveBudgetSpent(notifications, notifiedUserId, tz, now, 1),
      ];
    },
  },
];
