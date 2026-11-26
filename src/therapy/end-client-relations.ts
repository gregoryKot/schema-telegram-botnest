import { Prisma, RelationStatus } from '@prisma/client';
import { RelationEndReason } from './relation-end-reason';

// Связь клиента с аккаунтом заканчивается без удаления строки (решение
// владельца 2026-11-05): терапевт убрал клиента (remove-client.ts) или клиент
// отключился сам (TherapyRelationsService.disconnect). Строка получает
// `ended` с датой и причиной — по ней клиент видит строку о бывшем терапевте
// (former-therapist-info.ts). Доступа она не даёт: assertRelation, список
// клиентов, задания терапевта и карточка смотрят только на `active`.
// Частичный unique «одна активная связь на пару» (миграция 20261016100000)
// `ended` не касается, поэтому новый код к тому же терапевту подключает.
//
// В той же транзакции открытые задания этого терапевта этому клиенту
// становятся личными целями (assignedBy = null): метка «От терапевта» на
// сайте ставится по assignedBy, и без снятия она висела бы от человека, с
// которым связи уже нет, а сам терапевт снова видел бы их после повторного
// подключения. Выполненные и закрытые (done не null) — история, не трогаем.
// Задания снимаются только у терапевтов, чья связь закончилась в этом вызове:
// повторный DELETE без живой связи чужие данные клиента не меняет.
//
// Офлайн-клиентов (clientId NULL) здесь нет: их удаляет remove-client.ts.
// Возвращает число завершённых связей.
export async function endClientRelations(
  tx: Prisma.TransactionClient,
  scope: { clientId: bigint; therapistId?: bigint },
  reason: RelationEndReason,
): Promise<number> {
  const live = await tx.therapyRelation.findMany({
    where: { ...scope, status: { in: LIVE } },
    select: { id: true, therapistId: true },
  });
  if (live.length === 0) return 0;
  await tx.therapyRelation.updateMany({
    where: { id: { in: live.map((r) => r.id) }, status: { in: LIVE } },
    data: {
      status: RelationStatus.ended,
      endedAt: new Date(),
      endReason: reason,
    },
  });
  const therapists = [...new Set(live.map((r) => r.therapistId))];
  await tx.userTask.updateMany({
    where: {
      userId: scope.clientId,
      assignedBy: { in: therapists },
      done: null,
    },
    data: { assignedBy: null },
  });
  return live.length;
}

const LIVE: RelationStatus[] = ['pending', 'active'];
