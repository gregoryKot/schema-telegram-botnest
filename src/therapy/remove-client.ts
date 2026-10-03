import { PrismaService } from '../prisma/prisma.service';

// Удаление клиента терапевта (правило №10: вынесено из TherapyClientDataService).
// Насовсем стираются заметки по сессиям и концептуализация терапевта плюс сама
// связь. Все WHERE ограничены therapistId — чужой терапевт ничего не заденет.
//
// Виртуальный клиент (clientId = -TherapyRelation.id) аккаунта не имеет: его
// задания лежат в UserTask с отрицательным userId и БЕЗ FK, каскада нет —
// без явного удаления остаются сиротами. У клиента с аккаунтом (clientId > 0)
// задания принадлежат ему и остаются.
export async function removeTherapistClient(
  prisma: PrismaService,
  therapistId: bigint,
  clientId: number,
): Promise<void> {
  const cid = BigInt(clientId);
  const virtual = clientId < 0;
  await prisma.$transaction([
    prisma.therapistNote.deleteMany({ where: { therapistId, clientId: cid } }),
    prisma.clientConceptualization.deleteMany({
      where: { therapistId, clientId: cid },
    }),
    ...(virtual
      ? [
          prisma.userTask.deleteMany({
            where: { userId: cid, assignedBy: therapistId },
          }),
        ]
      : []),
    prisma.therapyRelation.deleteMany({
      where: virtual
        ? { id: -clientId, therapistId }
        : { therapistId, clientId: cid },
    }),
  ]);
}
