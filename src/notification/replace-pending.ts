import type { Prisma } from '@prisma/client';
import type { PrismaService } from '../prisma/prisma.service';
import { encryptPayload } from './notification-payload.crypto';
import type { NotificationType } from './notification.types';

type Db = Pick<PrismaService, '$transaction'>;
type Tx = Prisma.TransactionClient;

/**
 * Что планировщик ставит в день ВМЕСТО напоминания (planDay): перерывы,
 * зеркало данных на 14-й день, сводка недели. Пока такое стоит, замена
 * напоминания нового не ставит — в дне одно проактивное.
 */
export const REMINDER_STAND_INS = [
  'lapsing_3',
  'dormant_7',
  'value_recap',
  'reengagement_30',
  'nudge',
  'weekly',
] as const satisfies readonly NotificationType[];
export type ReminderStandIn = (typeof REMINDER_STAND_INS)[number];

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
 * Хвост волны 8: правка настроек решает «ставить напоминание» до лока. Если
 * за это время обход поставил вместо него перерыв или сводку (swapReminder),
 * напоминание не ставится — проверка под тем же локом видит его коммит.
 *
 * Лок транзакционный — снимается сам на commit/rollback и в пуле соединений
 * не зависает. Совпадение hashtext у двух людей лишь ненадолго выстроит их
 * в очередь.
 */
export async function replacePending(
  prisma: Db,
  userId: bigint,
  type: NotificationType,
  sendAt: Date,
  payload?: object,
): Promise<void> {
  await underRescheduleLock(prisma, userId, async (tx) => {
    await cancelPending(tx, userId, type);
    if (type === 'reminder' && (await standInPending(tx, userId))) return;
    await createPending(tx, userId, type, sendAt, payload);
  });
}

/**
 * Снять напоминание и поставить вместо него сообщение дня (перерыв,
 * value_recap, сводка) — под тем же локом и в той же транзакции, что замена
 * напоминания. Хвост волны 8: двумя запросами правка настроек на соседнем
 * инстансе вставала между ними, и в дне оставалось напоминание рядом с
 * сообщением о перерыве.
 */
export async function swapReminder(
  prisma: Db,
  userId: bigint,
  type: ReminderStandIn,
  sendAt: Date,
  payload?: object,
): Promise<void> {
  await underRescheduleLock(prisma, userId, async (tx) => {
    await cancelPending(tx, userId, 'reminder');
    await createPending(tx, userId, type, sendAt, payload);
  });
}

/** Одна транзакция под локом перепланировки человека — у обеих замен. */
async function underRescheduleLock(
  prisma: Db,
  userId: bigint,
  job: (tx: Tx) => Promise<void>,
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await lockReschedule(tx, userId);
    await job(tx);
  });
}

async function cancelPending(tx: Tx, userId: bigint, type: NotificationType) {
  await tx.scheduledNotification.updateMany({
    where: { userId, type, sentAt: null, cancelledAt: null },
    data: { cancelledAt: new Date() },
  });
}

async function standInPending(tx: Tx, userId: bigint): Promise<boolean> {
  const n = await tx.scheduledNotification.count({
    where: {
      userId,
      type: { in: [...REMINDER_STAND_INS] },
      sentAt: null,
      cancelledAt: null,
    },
  });
  return n > 0;
}

async function createPending(
  tx: Tx,
  userId: bigint,
  type: NotificationType,
  sendAt: Date,
  payload?: object,
) {
  await tx.scheduledNotification.create({
    data: { userId, type, sendAt, payload: encryptPayload(payload) },
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
