import { PrismaService } from '../prisma/prisma.service';

// Удаление клиента терапевта (правило №10: вынесено из TherapyClientDataService).
// Насовсем стираются заметки по сессиям, концептуализация и именные карты
// режимов (ModeMap) терапевта плюс сама связь. Карты без этого остались бы
// сиротами (виртуальный клиент) или всплыли при повторном подключении к тому
// же терапевту (клиент с аккаунтом). TherapistCustomMode — личная палитра
// терапевта, а не данные клиента: не трогаем. Все WHERE ограничены therapistId — чужой терапевт ничего не заденет.
//
// Виртуальный клиент (clientId = -TherapyRelation.id) аккаунта не имеет: его
// задания лежат в UserTask с отрицательным userId и БЕЗ FK, каскада нет —
// без явного удаления остаются сиротами. У клиента с аккаунтом (clientId > 0)
// задания принадлежат ему и остаются.
//
// Отрицательный id снимает связь только если она действительно виртуальная
// (clientId IS NULL): иначе DELETE /clients/-<id связи с реальным клиентом>
// сносил бы связь, оставляя заметки/концептуализацию/карты сиротами, которые
// всплыли бы при повторном подключении.
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
    prisma.modeMap.deleteMany({ where: { therapistId, clientId: cid } }),
    ...(virtual
      ? [
          prisma.userTask.deleteMany({
            where: { userId: cid, assignedBy: therapistId },
          }),
        ]
      : []),
    prisma.therapyRelation.deleteMany({
      where: virtual
        ? { id: -clientId, therapistId, clientId: null }
        : { therapistId, clientId: cid },
    }),
  ]);
}
