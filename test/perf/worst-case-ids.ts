// Контекст сценариев замера (test/perf/scenarios.ts): чьими данными мерить.
// Вынесено из scenarios.ts (правило №10): каждый новый горячий путь со своим
// «худшим случаем» дописывает сюда строку, а список сценариев не пухнет.
import { Client } from 'pg';
import { PrismaService } from '../../src/prisma/prisma.service';
import { PRACTICE_OWNER } from './seed-booking';
import { STREAK_COHORT } from './seed-streaks';

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
  /** Живая семья сессий с самой длинной цепочкой ротаций — её строки гвард
   *  Bearer перебирает по индексу family, пока не найдёт живую. */
  session: { userId: bigint; family: string };
  /** Терапевт когорты «долгий стрик» (seed-streaks.ts): годы оценок у клиентов. */
  streakTherapistId: bigint;
  /** Клиент владельца практики с самым большим числом броней (seed-booking.ts)
   *  и Telegram id владельца — сценарий кладёт его в ADMIN_ID. */
  bookingClient: { userId: bigint; ownerTelegramId: string };
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
    // Когорта «долгий стрик» — свой сценарий; история трекера мерится на
    // основной синтетике, как до неё (иначе сдвинулись бы планки history-*).
    `SELECT "userId"::text AS id FROM "Rating" WHERE "userId" < ${STREAK_COHORT.base}
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
  const session = (
    await client.query<{ id: string; family: string }>(
      `SELECT "userId"::text AS id, family FROM "WebSession" GROUP BY 1, 2
        HAVING bool_or("revokedAt" IS NULL) ORDER BY count(*) DESC, 2 LIMIT 1`,
    )
  ).rows[0];
  const streakTherapistId = await first(
    `SELECT "therapistId"::text AS id FROM "TherapyRelation"
      WHERE "therapistId" = ${STREAK_COHORT.base} AND status = 'active' LIMIT 1`,
  );
  const bookingClient = (
    await client.query<{ id: string; owner: string }>(
      `SELECT b."userId"::text AS id, p."providerId" AS owner FROM "Booking" b
        JOIN "TherapyRelation" r ON r."clientId" = b."userId" AND r.status = 'active'
        JOIN "AuthProvider" p ON p."userId" = r."therapistId" AND p.provider = 'telegram'
        WHERE r."therapistId" = ${PRACTICE_OWNER.userId}
        GROUP BY 1, 2 ORDER BY count(*) DESC, 1 LIMIT 1`,
    )
  ).rows[0];
  const ids = {
    therapistId,
    heavyUserId,
    unattachedUserId,
    notifiedUserId,
    streakTherapistId,
  };
  const missing = Object.entries(ids)
    .filter(([, v]) => !v)
    .map(([k]) => k);
  if (!session) missing.push('session');
  if (!bookingClient) missing.push('bookingClient');
  if (missing.length || !session || !bookingClient) {
    throw new Error(
      `В базе нет синтетики (${missing.join(', ')}) — ` +
        'прогони сидер: test/perf/seed.ts',
    );
  }
  return {
    ...(Object.fromEntries(
      Object.entries(ids).map(([k, v]) => [k, BigInt(v)]),
    ) as Omit<ScenarioContext, 'prisma' | 'session' | 'bookingClient'>),
    session: { userId: BigInt(session.id), family: session.family },
    bookingClient: {
      userId: BigInt(bookingClient.id),
      ownerTelegramId: bookingClient.owner,
    },
  };
}
