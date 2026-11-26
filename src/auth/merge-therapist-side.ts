import { Prisma } from '@prisma/client';

// Строки терапевта о клиенте (therapistId / clientId): карты режимов, пункты
// плана работы, путь клиента и отметки справочника. Обе стороны переезжают на
// target; clientId бывает отрицательным (офлайн-клиент) — remap это покрывает.
// `unique` — колонки unique-ключа таблицы: строка source, чей ключ после
// переезда уже есть у target, удаляется до UPDATE (побеждает target).
// Имена таблиц и колонок — литералы этого файла, не внешние данные.
type Side = 'therapistId' | 'clientId';
const TABLES: { table: Prisma.Sql; unique?: readonly string[] }[] = [
  { table: Prisma.raw('"ModeMap"') },
  { table: Prisma.raw('"TherapyPlanItem"') },
  { table: Prisma.raw('"TherapyPath"'), unique: ['therapistId', 'clientId'] },
  {
    table: Prisma.raw('"GuideMark"'),
    unique: ['therapistId', 'clientId', 'address', 'fragmentKey'],
  },
];

// Совпадение остальных колонок ключа: ` AND t."c" = s."c"` по каждой, кроме side.
const sameKey = (unique: readonly string[], side: Side): Prisma.Sql =>
  Prisma.raw(
    unique
      .filter((c) => c !== side)
      .map((c) => ` AND t."${c}" = s."${c}"`)
      .join(''),
  );

export async function remapTherapistSideRows(
  tx: Prisma.TransactionClient,
  sourceId: bigint,
  targetId: bigint,
): Promise<void> {
  for (const { table, unique } of TABLES) {
    if (unique)
      await tx.$executeRaw(Prisma.sql`
        DELETE FROM ${table} s USING ${table} t
        WHERE s."therapistId" = ${sourceId} AND t."therapistId" = ${targetId}${sameKey(unique, 'therapistId')}
      `);
    await tx.$executeRaw(Prisma.sql`
      UPDATE ${table} SET "therapistId" = ${targetId}
      WHERE "therapistId" = ${sourceId} AND "clientId" <> ${targetId}
    `);
    if (unique)
      await tx.$executeRaw(Prisma.sql`
        DELETE FROM ${table} s USING ${table} t
        WHERE s."clientId" = ${sourceId} AND t."clientId" = ${targetId}${sameKey(unique, 'clientId')}
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
