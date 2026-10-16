import { PrismaService } from '../prisma/prisma.service';
import { NotificationService } from '../notification/notification.service';
import { TherapyRelationsService } from './therapy-relations.service';

// Запрос терапевта «пройдите тест на схемы» (YSQ): клиенту уходит одно
// сообщение в личку. Аудит 2026-10: на каждый тап создавалась новая строка
// ScheduledNotification, очередь не дедуплицирует, и клиент получал пять
// одинаковых DM. Пока предыдущий запрос не отправлен (обычно до 5 минут, пока
// его не разберёт крон; в тихие часы клиента — до утра, ysq_requested не в
// QUIET_EXEMPT_TYPES), повтор — тихий no-op: клиент всё равно получит ровно
// одно сообщение. После отправки или отмены (клиент без Telegram) запрос снова
// ставится — дедуп не превращается в вечный запрет.
//
// Дедуп по клиенту, а не по паре с терапевтом: payload зашифрован, фильтровать
// по имени терапевта нельзя. Остаточную гонку (два параллельных запроса оба
// видят «пусто») сужают защита кнопки на фронте и лимит на маршруте со
// счётчиком в Postgres; почему не атомарно — docs/README.md, «Запрос YSQ».
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
  if (clientId < 0n) return; // Виртуальный клиент: нет Telegram, слать некуда
  if (await notifications.hasPending(clientId, 'ysq_requested')) return;
  const therapist = await prisma.user.findUnique({
    where: { id: therapistId },
    select: { firstName: true },
  });
  await notifications.schedule(clientId, 'ysq_requested', new Date(), {
    therapistName: therapist?.firstName ?? null,
  });
}
