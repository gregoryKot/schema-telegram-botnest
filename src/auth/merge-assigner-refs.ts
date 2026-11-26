import { Prisma } from '@prisma/client';

// «Висячие» ссылки на аккаунт при слиянии (аудит 2026-10, D-6): колонки, где
// userId другого человека хранится не в `userId`, поэтому цикл по
// USER_OWNED_TABLES их не видит, а FK у них нет — после удаления source они
// указывали бы на несуществующий аккаунт (а то и на чужой, если id переиспользуют):
// - UserTask.assignedBy — кто назначил задачу (терапевт). Строки самой задачи
//   переезжают по userId, а назначивший оставался source;
// - LoginTicket.approvedUserId — кто подтвердил вход по билету.
// Имена колонок — литералы в SQL, не из внешних данных.
export async function remapAssignerRefs(
  tx: Prisma.TransactionClient,
  sourceId: bigint,
  targetId: bigint,
): Promise<void> {
  await tx.$executeRaw(Prisma.sql`
    UPDATE "UserTask" SET "assignedBy" = ${targetId}
    WHERE "assignedBy" = ${sourceId}
  `);
  await tx.$executeRaw(Prisma.sql`
    UPDATE "LoginTicket" SET "approvedUserId" = ${targetId}
    WHERE "approvedUserId" = ${sourceId}
  `);
}
