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
import { BotAnalyticsService } from '../../src/bot/bot.analytics.service';
import { BotClientOverviewService } from '../../src/bot/bot.client-overview.service';
import { TherapyRelationsService } from '../../src/therapy/therapy-relations.service';
import { buildStatsReport } from '../e2e-support/stats-report.factory';

export interface ScenarioContext {
  prisma: PrismaService;
  /** Терапевт с самым длинным списком клиентов в синтетике. */
  therapistId: bigint;
  /** Пользователь с самой длинной историей оценок. */
  heavyUserId: bigint;
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
    run: ({ prisma }) =>
      Promise.all([
        new BotAdminStatsService(prisma).getAdminStats(),
        buildStatsReport(prisma).render(),
      ]),
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
];

/**
 * Худший случай в засеянных данных, а не «любая строка»: план у юзера с одной
 * записью и у юзера с годом истории разный, и мерить надо второго — иначе
 * гейт зеленел бы ровно там, где начинается боль.
 */
export async function resolveWorstCaseIds(
  client: Client,
): Promise<{ therapistId: bigint; heavyUserId: bigint }> {
  const therapist = await client.query<{ id: string }>(
    `SELECT "therapistId"::text AS id FROM "TherapyRelation"
      WHERE status = 'active' GROUP BY 1 ORDER BY count(*) DESC, 1 LIMIT 1`,
  );
  const heavy = await client.query<{ id: string }>(
    `SELECT "userId"::text AS id FROM "Rating"
      GROUP BY 1 ORDER BY count(*) DESC, 1 LIMIT 1`,
  );
  const therapistId = therapist.rows[0]?.id;
  const heavyUserId = heavy.rows[0]?.id;
  if (!therapistId || !heavyUserId) {
    throw new Error(
      'В базе нет синтетики (терапевта с клиентами / юзера с оценками) — ' +
        'прогони сидер: test/perf/seed.ts',
    );
  }
  return { therapistId: BigInt(therapistId), heavyUserId: BigInt(heavyUserId) };
}
