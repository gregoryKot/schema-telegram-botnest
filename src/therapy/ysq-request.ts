import { ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { inSerializableTx } from '../prisma/serializable-retry';
import { NotificationService } from '../notification/notification.service';
import { TherapyRelationsService } from './therapy-relations.service';
import { encrypt } from '../utils/crypto';

// Запрос терапевта «пройдите тест на схемы» (YSQ) — это задание клиенту
// (`UserTask`, type `ysq_test`, assignedBy = терапевт). QA 2026-11 (К1): раньше
// запрос был только сообщением Telegram-бота, у аккаунта без Telegram очередь
// его отменяла, а терапевт видел «✓ Запрос отправлен». Задание видно клиенту на
// обеих площадках (блок «От терапевта»), ведёт в тест и закрывается само, когда
// тест сохранён (`YsqService.saveYsqResult`, та же транзакция). Сообщение в
// Telegram осталось вторым каналом — кому есть куда его доставить.
//
// Один источник правды о запросе — открытое задание пары «терапевт → клиент»:
// по нему и дедуп (повтор, пока тест не пройден, — тихий no-op), и признак
// `ysqRequestPending` в карточке клиента. Второй терапевт клиента чужого
// задания не видит: фильтр по assignedBy. Терапевт снимает запрос, удалив
// задание (assigned-task.ts).
//
// Сообщение в личку дедуплицируется по клиенту: пока предыдущее не отправлено,
// второе не ставится (аудит 2026-10: на каждый тап уходило новое DM).
// «Проверка + вставка» задания — одна Serializable-транзакция с ретраем
// (`inSerializableTx`): из двух параллельных запросов второй получает P2034,
// перечитывает и видит задание первого — второго задания и DM нет.

/** UserTask.type задания «пройти тест на схемы». */
export const YSQ_TASK_TYPE = 'ysq_test';
const YSQ_TASK_TEXT = 'Пройти тест на схемы';
const NOTIFY_TYPE = 'ysq_requested';
const pair = (therapistId: bigint, clientId: bigint) => ({
  userId: clientId,
  assignedBy: therapistId,
  type: YSQ_TASK_TYPE,
});

/** Открытое задание YSQ этого терапевта этому клиенту — запрос висит. */
export async function isOwnYsqRequestPending(
  prisma: Pick<PrismaService, 'userTask'>,
  therapistId: bigint,
  clientId: bigint,
): Promise<boolean> {
  const open = await prisma.userTask.count({
    where: { ...pair(therapistId, clientId), done: null },
  });
  return open > 0;
}

export interface YsqRequestDeps {
  prisma: PrismaService;
  notifications: NotificationService;
  relations: TherapyRelationsService;
}

export async function requestYsq(
  { prisma, notifications, relations }: YsqRequestDeps,
  therapistId: bigint,
  clientId: bigint,
): Promise<void> {
  await relations.assertHasClient(therapistId, clientId);
  if (clientId < 0n) return; // Офлайн-клиент: аккаунта нет, тест пройти негде
  const text = encrypt(YSQ_TASK_TEXT) ?? YSQ_TASK_TEXT;
  const created = await inSerializableTx(
    prisma,
    async (tx) => {
      if (await isOwnYsqRequestPending(tx, therapistId, clientId)) return false;
      await tx.userTask.create({
        data: { ...pair(therapistId, clientId), text },
      });
      return true;
    },
    () => new ConflictException('Запрос уже отправляется из другого окна'),
  );
  if (!created) return;
  if (await notifications.hasPending(clientId, NOTIFY_TYPE)) return;
  const therapist = await prisma.user.findUnique({
    where: { id: therapistId },
    select: { firstName: true },
  });
  await notifications.schedule(clientId, NOTIFY_TYPE, new Date(), {
    therapistName: therapist?.firstName ?? null,
  });
}
