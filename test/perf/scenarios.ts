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
import { assertLiveAccess } from '../../src/auth/live-access';
import { ClientBookingService } from '../../src/booking/client-booking.service';
import type { BookingService } from '../../src/booking/booking.service';
import type { AnalyticsService } from '../../src/analytics/analytics.service';
import { AccountService } from '../../src/bot/account.service';
import { ConfigService } from '@nestjs/config';
import { vapidEnv, withEnv } from './scenario-env';
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
  {
    name: 'therapist-clients-long-streaks',
    title: 'Список клиентов терапевта: у каждого годы ежедневных оценок',
    // Стрик считается в SQL без общего потолка строк (src/bot/client-streaks.ts);
    // когорта 50 × 2600 дней — test/perf/seed-streaks.ts.
    run: ({ prisma, streakTherapistId }) =>
      new TherapyRelationsService(
        prisma,
        new BotClientOverviewService(prisma),
      ).getClients(streakTherapistId),
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
  {
    name: 'bearer-guard',
    title: 'Проверка Bearer на каждом запросе (аккаунт + живая сессия, S12)',
    // Ровно то, что делают JwtAuthGuard/TelegramAuthGuard/OptionalJwtGuard на
    // каждом запросе сайта (src/auth/live-access.ts) — на семье с самой
    // длинной цепочкой ротаций (seed-sessions.ts).
    run: ({ prisma, session }) =>
      assertLiveAccess(prisma, session.userId, session.family),
  },
  {
    name: 'client-booking',
    title:
      'Запись из приложения: можно ли и ближайшие брони (GET /api/client-booking)',
    // Ровно ClientBookingService.overview (#546): владелец по ADMIN_ID через
    // AuthProvider, связь клиента с ним, брони по (userId, startsAt). Уходит
    // при каждом открытии профиля клиентом с терапевтом. BookingService и
    // аналитику overview не трогает — заглушки; синтетика — seed-booking.ts.
    run: ({ prisma, bookingClient: c }) =>
      withEnv({ ADMIN_ID: c.ownerTelegramId }, async () => {
        const view = await new ClientBookingService(
          prisma,
          {} as BookingService,
          {} as AnalyticsService,
          new ConfigService(),
        ).overview(c.userId);
        // Без владельца или броней код ушёл бы короткой веткой — мерить нечего.
        if (!view.eligible || view.upcoming.length === 0) {
          throw new Error(
            'client-booking: клиент владельца без связи или броней',
          );
        }
        return view;
      }),
  },
  {
    name: 'notify-queue-tick',
    title: 'Тик очереди уведомлений: пачка getDue и настройки отправки',
    // Читающая часть runProcessQueue (telegram.schedule-queue.ts) до отправки:
    // getDue (take 500, старейшие первыми) и getSendSettingsFor — User с
    // адресом в Telegram и PushSubscription по userId IN (…). Отправка и
    // пометки — запись, её гейт не мерит. Хвост просроченных строк, который
    // даёт полную пачку, — seed-notifications.ts; подписки — seed-push.ts.
    run: async ({ prisma }) => {
      const due = await new NotificationService(prisma).getDue();
      if (due.length === 0) {
        throw new Error(
          'notify-queue-tick: очередь пуста — нет хвоста в синтетике',
        );
      }
      const ids = [...new Set(due.map((n) => n.userId))];
      return withEnv(vapidEnv(), () =>
        new AccountService(prisma).getSendSettingsFor(ids),
      );
    },
  },
];
