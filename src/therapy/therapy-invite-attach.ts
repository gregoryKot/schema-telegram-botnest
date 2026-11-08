import { PrismaService } from '../prisma/prisma.service';
import { meetingDaysOf } from './therapy-relation-info';

// Перенос данных офлайн-карточки (-TherapyRelation.id: задания, заметки, карты
// режимов, концептуализация) на аккаунт, когда терапевт подтвердил, что код
// карточки ввёл тот же человек (therapy-invite-card-claim.ts, S8). Всё в ОДНОЙ
// транзакции: половинный перенос оставил бы сирот без FK. Перечень таблиц
// сверяется со схемой в therapy-invite-attach.spec.ts.

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
    // одного документа слить нельзя: остаётся новее по updatedAt, при
    // равенстве — та, что уже на аккаунте.
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

    // Поля связи — только в пустые, имена зашифрованы — как есть. attachToId:
    // null ДО удаления карточки, иначе каскад снёс бы целевую строку с ней.
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
    // Связи других аккаунтов, ждущие сверки с карточкой, теряют отметку (их
    // снёс бы каскад); остаются приглашения — их у фейка удаляет deleteMany.
    await tx.therapyRelation.updateMany({
      where: { attachToId: card.id, clientId: { not: null } },
      data: { attachToId: null },
    });
    await tx.therapyRelation.deleteMany({ where: { attachToId: card.id } });
    await tx.therapyRelation.delete({ where: { id: card.id } });
    // Адрес карточки в кабинете (/cabinet/<urlCode>) переезжает вместе с
    // данными: сохранённая терапевтом ссылка открывает уже подключённого
    // клиента. Только после удаления карточки — код уникален.
    await tx.therapyRelation.update({
      where: { id: target.id },
      data: { urlCode: card.urlCode },
    });
    return true;
  });
}
