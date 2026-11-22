import type { Prisma } from '@prisma/client';

/**
 * Отметки справочника офлайн-карточки (-TherapyRelation.id) переезжают на
 * аккаунт клиента. Unique (therapistId, clientId, address): адрес, уже
 * отмеченный на аккаунте, остаётся аккаунтным, карточная копия удаляется.
 */
export async function moveGuideMarks(
  tx: Prisma.TransactionClient,
  therapistId: bigint,
  from: bigint,
  to: bigint,
): Promise<void> {
  const taken = await tx.guideMark.findMany({
    where: { therapistId, clientId: to },
    select: { address: true },
  });
  await tx.guideMark.deleteMany({
    where: {
      therapistId,
      clientId: from,
      address: { in: taken.map((m) => m.address) },
    },
  });
  await tx.guideMark.updateMany({
    where: { therapistId, clientId: from },
    data: { clientId: to },
  });
}
