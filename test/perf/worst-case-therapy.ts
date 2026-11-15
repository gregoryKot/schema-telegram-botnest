// Худший случай сценариев кабинета терапевта (scenarios-therapy.ts) — к
// worst-case-ids.ts (правило №10). Синтетика — seed-therapy.ts.
import type { Client } from 'pg';

export interface TherapyCaseIds {
  /** Клиент худшего терапевта с самой длинной историей: больше всех заметок
   *  сессий, у него же открытый запрос YSQ и годы прохождений теста. */
  heavyClientId: bigint;
  /** Бывший клиент без живой связи (иначе former-therapist уходит короткой
   *  веткой) с самым длинным хвостом завершённых связей с причиной. */
  formerClientId: bigint;
}

export async function resolveTherapyCaseIds(
  client: Client,
  therapistId: string,
): Promise<TherapyCaseIds> {
  const first = async (sql: string, values: string[] = []) =>
    (await client.query<{ id: string }>(sql, values)).rows[0]?.id;
  const heavy = await first(
    `SELECT "clientId"::text AS id FROM "TherapistNote" WHERE "therapistId" = $1
      GROUP BY 1 ORDER BY count(*) DESC, 1 LIMIT 1`,
    [therapistId],
  );
  const former = await first(
    `SELECT r."clientId"::text AS id FROM "TherapyRelation" r
      WHERE r.status = 'ended' AND r."endReason" IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM "TherapyRelation" l
        WHERE l."clientId" = r."clientId" AND l.status <> 'ended')
      GROUP BY 1 ORDER BY count(*) DESC, 1 LIMIT 1`,
  );
  if (!heavy || !former) {
    throw new Error(
      `В базе нет синтетики кабинета (${heavy ? 'formerClientId' : 'heavyClientId'}) — ` +
        'прогони сидер: test/perf/seed.ts',
    );
  }
  return { heavyClientId: BigInt(heavy), formerClientId: BigInt(former) };
}
