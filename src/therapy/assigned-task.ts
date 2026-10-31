import { PrismaService } from '../prisma/prisma.service';
import { activeRelationWhere } from './relation-where';

// Действия терапевта над заданием, которое он назначил (QA-проход 2026-10-26:
// задание нельзя было удалить ни в интерфейсе, ни в API, а задание
// офлайн-клиента — закрыть: выполнить его в приложении некому).
//
// Граница доступа — та же, что у всего therapy-контура: задание назначено
// ЭТИМ терапевтом (assignedBy) И связь с его владельцем сейчас активна
// (activeRelationWhere, офлайн-клиент — отрицательный userId =
// -TherapyRelation.id). Клиент, отключившийся от терапевта, забирает задания
// с собой (#865) — после разрыва связи терапевт их не трогает. Чужое,
// несуществующее и задание бывшего клиента неразличимы: везде false → 403.

async function ownTaskOwner(
  prisma: PrismaService,
  therapistId: bigint,
  taskId: number,
  offlineOnly: boolean,
): Promise<bigint | null> {
  const task = await prisma.userTask.findFirst({
    where: {
      id: taskId,
      assignedBy: therapistId,
      ...(offlineOnly ? { userId: { lt: 0n } } : {}),
    },
    select: { userId: true },
  });
  if (!task) return null;
  const rel = await prisma.therapyRelation.findFirst({
    where: activeRelationWhere(therapistId, task.userId),
    select: { id: true },
  });
  return rel ? task.userId : null;
}

/** Терапевт удаляет назначенное им задание своему текущему клиенту. */
export async function deleteAssignedTask(
  prisma: PrismaService,
  therapistId: bigint,
  taskId: number,
): Promise<boolean> {
  const owner = await ownTaskOwner(prisma, therapistId, taskId, false);
  if (owner === null) return false;
  const { count } = await prisma.userTask.deleteMany({
    where: { id: taskId, assignedBy: therapistId, userId: owner },
  });
  return count > 0;
}

/**
 * Терапевт отмечает задание офлайн-клиента выполненным (или «не вышло»).
 * Клиенту с аккаунтом — нет: своё задание он закрывает сам, и отметка
 * терапевта поверх неё выдавала бы чужое решение за действие клиента.
 */
export async function completeOfflineTask(
  prisma: PrismaService,
  therapistId: bigint,
  taskId: number,
  done: boolean,
): Promise<boolean> {
  const owner = await ownTaskOwner(prisma, therapistId, taskId, true);
  if (owner === null) return false;
  const { count } = await prisma.userTask.updateMany({
    where: { id: taskId, assignedBy: therapistId, userId: owner },
    data: { done, completedAt: new Date() },
  });
  return count > 0;
}
