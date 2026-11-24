import type { Prisma } from '@prisma/client';

/**
 * Отметки справочника офлайн-карточки (-TherapyRelation.id) переезжают на
 * аккаунт клиента. Unique (therapistId, clientId, address, fragmentKey): адрес с фрагментом, уже
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
    select: { address: true, fragmentKey: true },
  });
  await tx.guideMark.deleteMany({
    where: {
      therapistId,
      clientId: from,
      OR: taken.map((m) => ({
        address: m.address,
        fragmentKey: m.fragmentKey,
      })),
    },
  });
  await tx.guideMark.updateMany({
    where: { therapistId, clientId: from },
    data: { clientId: to },
  });
}
