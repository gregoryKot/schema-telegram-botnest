import { PrismaService } from '../prisma/prisma.service';
import { endClientRelations } from './end-client-relations';
import { THERAPIST_REMOVED } from './relation-end-reason';

// Удаление клиента терапевтом (правило №10: вынесено из TherapyClientDataService).
// Насовсем стираются заметки по сессиям, концептуализация и именные карты
// режимов (ModeMap) терапевта: это его записи о клиенте, и удаляет он их явно.
// Иначе карты остались бы сиротами (офлайн-клиент) или всплыли при повторном
// подключении того же клиента. TherapistCustomMode — личная палитра терапевта,
// а не данные клиента: не трогаем. Все WHERE ограничены therapistId — чужой
// терапевт ничего не заденет.
//
// Клиент с аккаунтом (clientId > 0): связь не удаляется, а завершается
// (`ended`, причина therapist_removed, end-client-relations.ts) — клиент
// видит строку о бывшем терапевте, а открытые задания этого терапевта
// становятся его личными целями (решение владельца 2026-11-05).
//
// Офлайн-клиент (clientId = -TherapyRelation.id) аккаунта не имеет: всё
// удаляется, как раньше. Его задания лежат в UserTask с отрицательным userId
// и БЕЗ FK, каскада нет — без явного удаления остались бы сиротами.
// Отрицательный id снимает связь только если она действительно офлайн
// (clientId IS NULL): иначе DELETE /clients/-<id связи с реальным клиентом>
// сносил бы связь, оставляя заметки/концептуализацию/карты сиротами.
export async function removeTherapistClient(
  prisma: PrismaService,
  therapistId: bigint,
  cid: bigint,
): Promise<void> {
  const own = { therapistId, clientId: cid };
  if (cid > 0n) {
    await prisma.$transaction(async (tx) => {
      await tx.therapistNote.deleteMany({ where: own });
      await tx.clientConceptualization.deleteMany({ where: own });
      await tx.modeMap.deleteMany({ where: own });
      await endClientRelations(tx, own, THERAPIST_REMOVED);
    });
    return;
  }
  await prisma.$transaction([
    prisma.therapistNote.deleteMany({ where: own }),
    prisma.clientConceptualization.deleteMany({ where: own }),
    prisma.modeMap.deleteMany({ where: own }),
    prisma.userTask.deleteMany({
      where: { userId: cid, assignedBy: therapistId },
    }),
    // Приглашения из карточки: на живой БД их снесёт каскад attachToId, у
    // фейка (без FK) — единственный путь.
    prisma.therapyRelation.deleteMany({
      where: { therapistId, attachToId: Number(-cid) },
    }),
    prisma.therapyRelation.deleteMany({
      where: { id: Number(-cid), therapistId, clientId: null },
    }),
  ]);
}
