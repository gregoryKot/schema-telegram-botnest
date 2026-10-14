import { Prisma } from '@prisma/client';

// Завершение всех связей терапевта при отказе от роли (аудит 2026-10-11,
// backend#33). Раньше resign снимал роль и не трогал TherapyRelation: клиент
// дальше видел «Мой терапевт» и ссылку «Написать» на бывшего, терапевт снять
// клиентов не мог (кабинет закрыт, 403), а повторное одобрение роли мгновенно
// оживляло все связи без согласия клиентов.
//
// Статус `ended`, а не удаление: заметки, концептуализации, карты режимов и
// задания терапевта остаются как есть (что с ними делать — решение владельца,
// docs/README.md → «Что осталось открытым»). Связь обратно не оживает —
// getClients/assertRelation/getRelationInfo смотрят только на `active`, а новая
// связь появляется лишь через новое приглашение.
//
// `pending` завершается тоже: неиспользованный код-приглашение бывшего
// терапевта иначе мог бы принять клиент (joinTherapyAsClient роли не сверяет).
//
// Принимает транзакционный клиент, чтобы смена роли и связи менялись вместе.
export async function endTherapistRelations(
  tx: Prisma.TransactionClient,
  therapistId: bigint,
): Promise<number> {
  const res = await tx.therapyRelation.updateMany({
    where: { therapistId, status: { in: ['pending', 'active'] } },
    data: { status: 'ended' },
  });
  return res.count;
}
