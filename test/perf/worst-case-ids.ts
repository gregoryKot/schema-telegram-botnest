// Контекст сценариев замера (test/perf/scenarios.ts): чьими данными мерить.
// Вынесено из scenarios.ts (правило №10): каждый новый горячий путь со своим
// «худшим случаем» дописывает сюда строку, а список сценариев не пухнет.
import { Client } from 'pg';
import { PrismaService } from '../../src/prisma/prisma.service';

export interface ScenarioContext {
  prisma: PrismaService;
  /** Терапевт с самым длинным списком клиентов в синтетике. */
  therapistId: bigint;
  /** Пользователь с самой длинной историей оценок. */
  heavyUserId: bigint;
  /** Ничей не клиент — так профиль сайта видит клиента без терапевта. */
  unattachedUserId: bigint;
  /** Больше всех строк в очереди уведомлений (отправленные + снятые + ждущие). */
  notifiedUserId: bigint;
}

/**
 * Худший случай в засеянных данных, а не «любая строка»: план у юзера с одной
 * записью и у юзера с годом истории разный, и мерить надо второго — иначе
 * гейт зеленел бы ровно там, где начинается боль.
 */
export async function resolveWorstCaseIds(
  client: Client,
): Promise<Omit<ScenarioContext, 'prisma'>> {
  const first = async (sql: string) =>
    (await client.query<{ id: string }>(sql)).rows[0]?.id;
  const therapistId = await first(
    `SELECT "therapistId"::text AS id FROM "TherapyRelation"
      WHERE status = 'active' GROUP BY 1 ORDER BY count(*) DESC, 1 LIMIT 1`,
  );
  const heavyUserId = await first(
    `SELECT "userId"::text AS id FROM "Rating"
      GROUP BY 1 ORDER BY count(*) DESC, 1 LIMIT 1`,
  );
  // В синтетике это терапевт (клиенты — все остальные); план от роли не зависит.
  const unattachedUserId = await first(
    `SELECT u."id"::text AS id FROM "User" u WHERE NOT EXISTS (
      SELECT 1 FROM "TherapyRelation" r WHERE r."clientId" = u."id") ORDER BY 1 LIMIT 1`,
  );
  const notifiedUserId = await first(
    `SELECT "userId"::text AS id FROM "ScheduledNotification"
      GROUP BY 1 ORDER BY count(*) DESC, 1 LIMIT 1`,
  );
  if (!therapistId || !heavyUserId || !unattachedUserId || !notifiedUserId) {
    throw new Error(
      'В базе нет синтетики (терапевта с клиентами / юзера с оценками / ' +
        'очереди уведомлений) — прогони сидер: test/perf/seed.ts',
    );
  }
  return {
    therapistId: BigInt(therapistId),
    heavyUserId: BigInt(heavyUserId),
    unattachedUserId: BigInt(unattachedUserId),
    notifiedUserId: BigInt(notifiedUserId),
  };
}
