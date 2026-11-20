import { Prisma } from '@prisma/client';

// Строки терапевта о клиенте (therapistId / clientId): карты режимов, пункты
// плана работы и отметки справочника. Обе стороны переезжают на target;
// clientId бывает отрицательным (офлайн-клиент) — обычный remap это покрывает.
// У GuideMark unique (therapistId, clientId, address): строка source, чей ключ
// после переезда уже есть у target, удаляется до UPDATE (побеждает target).
// Имена таблиц — литералы этого файла, не внешние данные.
const TABLES = [
  { table: Prisma.raw('"ModeMap"'), unique: false },
  { table: Prisma.raw('"TherapyPlanItem"'), unique: false },
  { table: Prisma.raw('"GuideMark"'), unique: true },
];

export async function remapTherapistSideRows(
  tx: Prisma.TransactionClient,
  sourceId: bigint,
  targetId: bigint,
): Promise<void> {
  for (const { table, unique } of TABLES) {
    if (unique)
      await tx.$executeRaw(Prisma.sql`
        DELETE FROM ${table} s USING ${table} t
        WHERE s."therapistId" = ${sourceId} AND t."therapistId" = ${targetId}
          AND t."clientId" = s."clientId" AND t."address" = s."address"
      `);
    await tx.$executeRaw(Prisma.sql`
      UPDATE ${table} SET "therapistId" = ${targetId}
      WHERE "therapistId" = ${sourceId} AND "clientId" <> ${targetId}
    `);
    if (unique)
      await tx.$executeRaw(Prisma.sql`
        DELETE FROM ${table} s USING ${table} t
        WHERE s."clientId" = ${sourceId} AND t."clientId" = ${targetId}
          AND t."therapistId" = s."therapistId" AND t."address" = s."address"
      `);
    await tx.$executeRaw(Prisma.sql`
      UPDATE ${table} SET "clientId" = ${targetId}
      WHERE "clientId" = ${sourceId} AND "therapistId" <> ${targetId}
    `);
    // Остаток — петли «терапевт сам себе клиент»: удаляются.
    await tx.$executeRaw(Prisma.sql`
      DELETE FROM ${table} WHERE "therapistId" = ${sourceId} OR "clientId" = ${sourceId}
    `);
  }
}
