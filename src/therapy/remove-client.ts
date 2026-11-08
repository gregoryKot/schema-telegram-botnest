import { PrismaService } from '../prisma/prisma.service';
import { endClientRelations } from './end-client-relations';
import { THERAPIST_REMOVED } from './relation-end-reason';

// Удаление клиента терапевтом (правило №10: вынесено из TherapyClientDataService).
// Насовсем стираются заметки по сессиям, концептуализация и именные карты
// режимов (ModeMap) терапевта: это его записи о клиенте, и удаляет он их явно.
// Иначе карты остались бы сиротами (офлайн-клиент) или всплыли при повторном
// подключении того же клиента. TherapistCustomMode — палитра терапевта, не
// трогаем. Все WHERE ограничены therapistId — чужой терапевт ничего не заденет.
// Клиент с аккаунтом (clientId > 0): связь не удаляется, а завершается
// (`ended`, причина therapist_removed, end-client-relations.ts) — клиент
// видит строку о бывшем терапевте, а открытые задания этого терапевта
// становятся его личными целями (решение владельца 2026-11-05).
//
// Офлайн-клиент (clientId = -TherapyRelation.id) аккаунта не имеет: всё
// удаляется. Его задания (UserTask с отрицательным userId) без FK и каскада.
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
  const card = { therapistId, attachToId: Number(-cid) };
  await prisma.$transaction([
    prisma.therapistNote.deleteMany({ where: own }),
    prisma.clientConceptualization.deleteMany({ where: own }),
    prisma.modeMap.deleteMany({ where: own }),
    prisma.userTask.deleteMany({
      where: { userId: cid, assignedBy: therapistId },
    }),
    // Связь аккаунта, ждущая сверки с карточкой (S8), теряет отметку — её
    // снёс бы каскад; оставшиеся приглашения у фейка удаляет deleteMany.
    prisma.therapyRelation.updateMany({
      where: { ...card, clientId: { not: null } },
      data: { attachToId: null },
    }),
    prisma.therapyRelation.deleteMany({ where: card }),
    prisma.therapyRelation.deleteMany({
      where: { id: Number(-cid), therapistId, clientId: null },
    }),
  ]);
}
