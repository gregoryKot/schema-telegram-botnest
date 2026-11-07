import { Prisma, RelationStatus } from '@prisma/client';
import { THERAPIST_RESIGNED } from './relation-end-reason';

// Завершение связей терапевта при отказе от роли (аудит 2026-10-11, backend#33):
// иначе клиент видел бы бывшего в «Мой терапевт», а повторное одобрение роли
// оживляло бы связи без согласия клиентов. Новая связь — только по приглашению.
// Статус `ended` с датой и причиной, строка не удаляется: заметки, карты режимов
// и задания терапевта остаются у клиента как история (решение владельца
// 2026-10-22), клиент видит сообщение о бывшем терапевте (former-therapist-info.ts).
// getClients/assertRelation/getRelationInfo смотрят только на `active`.
//
// Офлайн-клиенты (clientId NULL, virtualClientName задан) остаются `active`: у
// них нет стороны клиента и согласия, которое можно нарушить. Это записи самого
// терапевта — концептуализации и задания висят на -TherapyRelation.id, а Step D
// слияния аккаунтов (merge.service.ts) удаляет концептуализации виртуальных
// клиентов без active-связи. После повторного одобрения роли список вернётся.
// `pending` (приглашение без имени) завершается: иначе код бывшего терапевта мог
// бы принять клиент (joinTherapyAsClient роли не сверяет).
//
// Транзакционный клиент — смена роли и связи меняются вместе. Возвращает число
// завершённых связей с настоящими клиентами (для /stats, приглашения не в счёт).
export async function endTherapistRelations(
  tx: Prisma.TransactionClient,
  therapistId: bigint,
): Promise<number> {
  const live = { therapistId, status: { in: LIVE } };
  const data = {
    status: RelationStatus.ended,
    endedAt: new Date(),
    endReason: THERAPIST_RESIGNED,
  };
  const clients = await tx.therapyRelation.updateMany({
    where: { ...live, clientId: { not: null } },
    data,
  });
  await tx.therapyRelation.updateMany({
    where: { ...live, clientId: null, virtualClientName: null },
    data,
  });
  return clients.count;
}

const LIVE: RelationStatus[] = ['pending', 'active'];
