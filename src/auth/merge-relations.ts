import { Prisma } from '@prisma/client';

// Pair и TherapyRelation при слиянии (аудит 2026-10: слияние плодило дубли
// активных связей). Ремап userId1/userId2 и therapistId/clientId без дедупа давал
// после merge S→T две активные строки (TH,T) и две (T,X): клиент у терапевта и
// партнёр у друга показывались дважды. Теперь инвариант «одна активная связь на
// пару» держат частичные unique-индексы (миграция 20261016100000), а значит,
// дубль обязан исчезнуть ДО ремапа: unique-индекс Postgres проверяет построчно,
// и UPDATE, создающий вторую активную строку, упал бы 23505.
// Политика та же, что во всём merge: «target wins» — строка source, чья пара
// после ремапа совпала бы с активной строкой target, дропается. Pending/ended
// строки индексы не касаются и переезжают как есть.

/** Колонка связи терапевта, по которой source и target меняются местами. */
type Side = 'therapistId' | 'clientId';

// Имена колонок — литералы из типа Side, не внешние данные.
const col = (c: string) => Prisma.raw(`"${c}"`);

/**
 * Активная связь терапевт↔клиент есть у обоих: данные source (имя клиента,
 * даты, дни встреч) доливаются в строку target там, где у target пусто
 * (у meetingDays «пусто» — это `[]`: колонка NOT NULL), строка source
 * дропается. `side` — какую роль играет сливаемый аккаунт в дублях.
 * Сравнение `=` по второй колонке не матчит NULL: офлайн-клиенты
 * (clientId IS NULL) дублями друг друга не считаются и переезжают.
 */
async function dedupeTherapyRelations(
  tx: Prisma.TransactionClient,
  side: Side,
  sourceId: bigint,
  targetId: bigint,
): Promise<void> {
  const mine = col(side);
  const other = col(side === 'therapistId' ? 'clientId' : 'therapistId');
  await tx.$executeRaw(Prisma.sql`
    UPDATE "TherapyRelation" t SET
      "clientAlias" = COALESCE(t."clientAlias", s."clientAlias"),
      "therapyStartDate" = COALESCE(t."therapyStartDate", s."therapyStartDate"),
      "nextSession" = COALESCE(t."nextSession", s."nextSession"),
      "meetingDays" = CASE WHEN t."meetingDays" = '[]'::jsonb
        THEN s."meetingDays" ELSE t."meetingDays" END
    FROM "TherapyRelation" s
    WHERE s."status" = 'active' AND t."status" = 'active'
      AND s.${mine} = ${sourceId} AND t.${mine} = ${targetId}
      AND s.${other} = t.${other}
  `);
  await tx.$executeRaw(Prisma.sql`
    DELETE FROM "TherapyRelation" s
    WHERE s."status" = 'active' AND s.${mine} = ${sourceId}
      AND EXISTS (
        SELECT 1 FROM "TherapyRelation" t
        WHERE t."status" = 'active' AND t.${mine} = ${targetId}
          AND t.${other} = s.${other}
      )
  `);
}

/** «Второй участник» пары относительно `me` (пара хранится в любой ориентации). */
const partnerOf = (alias: string, me: bigint) =>
  Prisma.sql`CASE WHEN ${Prisma.raw(alias)}."userId1" = ${me}
    THEN ${Prisma.raw(alias)}."userId2" ELSE ${Prisma.raw(alias)}."userId1" END`;

/** Активная пара source с X, когда у target уже есть активная пара с X. */
async function dedupePairs(
  tx: Prisma.TransactionClient,
  sourceId: bigint,
  targetId: bigint,
): Promise<void> {
  await tx.$executeRaw(Prisma.sql`
    DELETE FROM "Pair" s
    WHERE s."status" = 'active'
      AND (s."userId1" = ${sourceId} OR s."userId2" = ${sourceId})
      AND EXISTS (
        SELECT 1 FROM "Pair" t
        WHERE t."status" = 'active'
          AND (t."userId1" = ${targetId} OR t."userId2" = ${targetId})
          AND ${partnerOf('s', sourceId)} = ${partnerOf('t', targetId)}
      )
  `);
}

export async function remapRelations(
  tx: Prisma.TransactionClient,
  sourceId: bigint,
  targetId: bigint,
): Promise<void> {
  // 3. Pair: у таблицы две ссылки на пользователя — source может быть в любой.
  await dedupePairs(tx, sourceId, targetId);
  await tx.$executeRaw(Prisma.sql`
    UPDATE "Pair" SET "userId1" = ${targetId}
    WHERE "userId1" = ${sourceId} AND ("userId2" IS NULL OR "userId2" <> ${targetId})
  `);
  await tx.$executeRaw(Prisma.sql`
    UPDATE "Pair" SET "userId2" = ${targetId}
    WHERE "userId2" = ${sourceId} AND "userId1" <> ${targetId}
  `);
  // Всё, что осталось, указывает на source, а вторая сторона уже target →
  // получилась бы пара с самим собой; просто дропаем.
  await tx.$executeRaw(Prisma.sql`
    DELETE FROM "Pair" WHERE "userId1" = ${sourceId} OR "userId2" = ${sourceId}
  `);

  // 4. TherapyRelation (therapistId / clientId).
  await dedupeTherapyRelations(tx, 'clientId', sourceId, targetId);
  await dedupeTherapyRelations(tx, 'therapistId', sourceId, targetId);
  // NOTE: IS DISTINCT FROM вместо <>, чтобы NULL clientId (офлайн-клиенты)
  // обрабатывался верно. С обычным <> выражение NULL <> targetId даёт NULL,
  // UPDATE пропускается, и строки уходят под DELETE ниже безвозвратно.
  await tx.$executeRaw(Prisma.sql`
    UPDATE "TherapyRelation" SET "therapistId" = ${targetId}
    WHERE "therapistId" = ${sourceId}
      AND "clientId" IS DISTINCT FROM ${targetId}
  `);
  await tx.$executeRaw(Prisma.sql`
    UPDATE "TherapyRelation" SET "clientId" = ${targetId}
    WHERE "clientId" = ${sourceId} AND "therapistId" <> ${targetId}
  `);
  await tx.$executeRaw(Prisma.sql`
    DELETE FROM "TherapyRelation" WHERE "therapistId" = ${sourceId} OR "clientId" = ${sourceId}
  `);
}
