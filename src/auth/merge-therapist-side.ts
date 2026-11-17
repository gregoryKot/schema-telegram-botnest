import { Prisma } from '@prisma/client';

// Строки терапевта о клиенте (therapistId / clientId, без FK и unique):
// карты режимов и пункты плана работы. Обе стороны переезжают на target;
// clientId бывает отрицательным (офлайн-клиент) — обычный remap это покрывает.
// Имена таблиц — литералы этого файла, не внешние данные.
const TABLES = [Prisma.raw('"ModeMap"'), Prisma.raw('"TherapyPlanItem"')];

export async function remapTherapistSideRows(
  tx: Prisma.TransactionClient,
  sourceId: bigint,
  targetId: bigint,
): Promise<void> {
  for (const table of TABLES) {
    await tx.$executeRaw(Prisma.sql`
      UPDATE ${table} SET "therapistId" = ${targetId}
      WHERE "therapistId" = ${sourceId} AND "clientId" <> ${targetId}
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
