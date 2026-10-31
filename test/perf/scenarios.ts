// Горячие пути, у которых меряется план. Состав — из аудита (D-4 в
// docs/archive/PROJECT_AUDIT_ADDENDUM.md: «первый кандидат в узкое место») и
// из перечня, названного владельцем: список клиентов терапевта, история
// 30 дней, админский отчёт /stats.
//
// Сценарий — это вызов РЕАЛЬНОГО сервиса, а не SQL-строка: что именно уйдёт в
// базу, решает код прода, и записывается это драйвером (record-sql.ts). Так
// новый запрос внутри уже измеряемого пути попадает под гейт сам, без того
// чтобы кто-то вспомнил его зарегистрировать.
import { Client } from 'pg';
import { PrismaService } from '../../src/prisma/prisma.service';
import { BotAdminStatsService } from '../../src/bot/bot.admin-stats.service';
import { BLOCK_FAILED_MARK } from '../../src/bot/stats-settle';
import { BotAnalyticsService } from '../../src/bot/bot.analytics.service';
import { BotClientOverviewService } from '../../src/bot/bot.client-overview.service';
import { TherapyRelationsService } from '../../src/therapy/therapy-relations.service';
import { getFormerTherapistInfo } from '../../src/therapy/former-therapist-info';
import { buildStatsReport } from '../e2e-support/stats-report.factory';

export interface ScenarioContext {
  prisma: PrismaService;
  /** Терапевт с самым длинным списком клиентов в синтетике. */
  therapistId: bigint;
  /** Пользователь с самой длинной историей оценок. */
  heavyUserId: bigint;
  /** Ничей не клиент — так профиль сайта видит клиента без терапевта. */
  unattachedUserId: bigint;
}

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
    name: 'history-30d',
    title: 'История трекера за 30 дней (GET /api/tracker/history)',
    run: ({ prisma, heavyUserId }) =>
      new BotAnalyticsService(prisma).getHistoryRatings(heavyUserId, 30),
  },
  {
    name: 'former-therapist',
    title: 'Бывший терапевт клиента (GET /api/therapy/former-therapist)',
    // Уходит при каждом открытии профиля сайта у клиента без терапевта. Связей
    // `ended` в синтетике нет (docs/open/therapy.md) — меряется частый путь.
    run: ({ prisma, unattachedUserId }) =>
      getFormerTherapistInfo(prisma, unattachedUserId),
  },
];

/**
 * Худший случай в засеянных данных, а не «любая строка»: план у юзера с одной
 * записью и у юзера с годом истории разный, и мерить надо второго — иначе
 * гейт зеленел бы ровно там, где начинается боль.
 */
export async function resolveWorstCaseIds(
  client: Client,
): Promise<Omit<ScenarioContext, 'prisma'>> {
  const therapist = await client.query<{ id: string }>(
    `SELECT "therapistId"::text AS id FROM "TherapyRelation"
      WHERE status = 'active' GROUP BY 1 ORDER BY count(*) DESC, 1 LIMIT 1`,
  );
  const heavy = await client.query<{ id: string }>(
    `SELECT "userId"::text AS id FROM "Rating"
      GROUP BY 1 ORDER BY count(*) DESC, 1 LIMIT 1`,
  );
  // В синтетике это терапевт (клиенты — все остальные); план от роли не зависит.
  const unattached = await client.query<{ id: string }>(
    `SELECT u."id"::text AS id FROM "User" u WHERE NOT EXISTS (
      SELECT 1 FROM "TherapyRelation" r WHERE r."clientId" = u."id") ORDER BY 1 LIMIT 1`,
  );
  const therapistId = therapist.rows[0]?.id;
  const heavyUserId = heavy.rows[0]?.id;
  const unattachedUserId = unattached.rows[0]?.id;
  if (!therapistId || !heavyUserId || !unattachedUserId) {
    throw new Error(
      'В базе нет синтетики (терапевта с клиентами / юзера с оценками) — ' +
        'прогони сидер: test/perf/seed.ts',
    );
  }
  return {
    therapistId: BigInt(therapistId),
    heavyUserId: BigInt(heavyUserId),
    unattachedUserId: BigInt(unattachedUserId),
  };
}
