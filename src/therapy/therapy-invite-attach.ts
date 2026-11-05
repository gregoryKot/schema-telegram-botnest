import { PrismaService } from '../prisma/prisma.service';
import { meetingDaysOf } from './therapy-relation-info';

// Перенос данных офлайн-карточки на аккаунт клиента, когда он принял
// приглашение «из карточки» (TherapyRelation.attachToId). Данные карточки
// лежат на отрицательном id (-TherapyRelation.id): задания, заметки, карты
// режимов, концептуализация. Всё в ОДНОЙ транзакции: половинный перенос
// оставил бы терапевту часть записей на карточке, которой уже нет (сироты без
// FK), а часть — на аккаунте. Перечень таблиц сверяется со схемой в
// therapy-invite-attach.spec.ts — новая таблица с парой therapistId+clientId
// без переноса роняет спек (так же, как remove-client.spec.ts).

/** false — карточки или активной связи с клиентом нет, ничего не тронуто. */
export async function attachOfflineCard(
  prisma: PrismaService,
  therapistId: bigint,
  clientId: bigint,
  attachToId: number,
): Promise<boolean> {
  return prisma.$transaction(async (tx) => {
    const card = await tx.therapyRelation.findFirst({
      where: { id: attachToId, therapistId, clientId: null },
    });
    if (!card) return false; // карточку уже удалили или слили
    const target = await tx.therapyRelation.findFirst({
      where: { therapistId, clientId, status: 'active' },
    });
    if (!target) return false;

    const neg = -BigInt(card.id);
    await tx.userTask.updateMany({
      where: { userId: neg, assignedBy: therapistId },
      data: { userId: clientId },
    });
    await tx.therapistNote.updateMany({
      where: { therapistId, clientId: neg },
      data: { clientId },
    });
    await tx.modeMap.updateMany({
      where: { therapistId, clientId: neg },
      data: { clientId },
    });

    // Концептуализация уникальна по паре therapistId+clientId. Две версии
    // одного документа слить нельзя, поэтому остаётся новее по updatedAt:
    // терапевт правил её позже — она и актуальна. При равенстве побеждает
    // та, что уже на аккаунте.
    const offline = await tx.clientConceptualization.findFirst({
      where: { therapistId, clientId: neg },
    });
    if (offline) {
      const existing = await tx.clientConceptualization.findFirst({
        where: { therapistId, clientId },
      });
      if (!existing) {
        await tx.clientConceptualization.update({
          where: { id: offline.id },
          data: { clientId },
        });
      } else if (offline.updatedAt.getTime() > existing.updatedAt.getTime()) {
        await tx.clientConceptualization.delete({ where: { id: existing.id } });
        await tx.clientConceptualization.update({
          where: { id: offline.id },
          data: { clientId },
        });
      } else {
        await tx.clientConceptualization.delete({ where: { id: offline.id } });
      }
    }

    // Поля связи копируются только в пустые; имена зашифрованы — как есть.
    // attachToId: null ДО удаления карточки: целевая строка сама может быть
    // приглашением с attachToId = card.id, и каскад снёс бы её вместе с картой.
    const ownDays = meetingDaysOf(target.meetingDays);
    await tx.therapyRelation.update({
      where: { id: target.id },
      data: {
        attachToId: null,
        clientAlias: target.clientAlias ?? card.virtualClientName ?? null,
        therapyStartDate: target.therapyStartDate ?? card.therapyStartDate,
        nextSession: target.nextSession ?? card.nextSession,
        meetingDays: ownDays.length ? ownDays : meetingDaysOf(card.meetingDays),
      },
    });
    // На живой БД приглашения карточки снесёт каскад; у фейка его нет.
    await tx.therapyRelation.deleteMany({ where: { attachToId: card.id } });
    await tx.therapyRelation.delete({ where: { id: card.id } });
    return true;
  });
}
