import type { Prisma } from '@prisma/client';
import type { PrismaService } from '../prisma/prisma.service';
import { encryptPayload } from './notification-payload.crypto';
import type { NotificationType } from './notification.types';

/**
 * Снять неотправленные уведомления типа `type` и поставить одно новое —
 * атомарно и для соседних инстансов.
 *
 * Хвост E16 (аудит 2026-11): перепланировка напоминания «снять, затем
 * поставить» шла двумя запросами. Внутри процесса порядок держит очередь
 * (src/utils/per-key-queue.ts), но полуночный обход на одном инстансе и
 * правка настроек на другом шли вперемешку — «снять, снять, поставить,
 * поставить», — и в очереди оставалось два напоминания. Теперь пара идёт в
 * транзакции под advisory-локом на человека: второй ждёт коммита первого и
 * снимает уже его строку (UPDATE после лока видит закоммиченное).
 *
 * Лок транзакционный — снимается сам на commit/rollback и в пуле соединений
 * не зависает. Совпадение hashtext у двух людей лишь ненадолго выстроит их
 * в очередь.
 */
export async function replacePending(
  prisma: Pick<PrismaService, '$transaction'>,
  userId: bigint,
  type: NotificationType,
  sendAt: Date,
  payload?: object,
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await lockReschedule(tx, userId);
    await tx.scheduledNotification.updateMany({
      where: { userId, type, sentAt: null, cancelledAt: null },
      data: { cancelledAt: new Date() },
    });
    await tx.scheduledNotification.create({
      data: { userId, type, sendAt, payload: encryptPayload(payload) },
    });
  });
}

/**
 * Лок перепланировки одного человека до конца транзакции. Функция возвращает
 * `void`, поэтому `$executeRaw`, а не `$queryRaw` (правило №18,
 * booking-slot-lock.ts); живой прогон — test/raw-sql-live-infra.e2e-spec.ts.
 */
export async function lockReschedule(
  tx: Pick<Prisma.TransactionClient, '$executeRaw'>,
  userId: bigint,
): Promise<void> {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`reschedule:${userId}`}))`;
}
