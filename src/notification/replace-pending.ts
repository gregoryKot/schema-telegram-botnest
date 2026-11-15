import type { Prisma } from '@prisma/client';
import type { PrismaService } from '../prisma/prisma.service';
import { encryptPayload, cancelledNow } from './notification-payload.crypto';
import type { NotificationType } from './notification.types';

type Db = Pick<PrismaService, '$transaction'>;
type Tx = Prisma.TransactionClient;

/**
 * Что планировщик ставит в день ВМЕСТО напоминания (planDay): перерывы,
 * зеркало данных на 14-й день, сводка недели, донат 1-го числа, невыполненный
 * план и инсайт о низкой потребности (последние три — хвост волны 9). Пока
 * такое стоит, замена напоминания нового не ставит — в дне одно проактивное.
 */
export const REMINDER_STAND_INS = [
  'lapsing_3',
  'dormant_7',
  'value_recap',
  'reengagement_30',
  'nudge',
  'weekly',
  'donate_reminder',
  'practice_missed',
  'low_streak_insight',
] as const satisfies readonly NotificationType[];
export type ReminderStandIn = (typeof REMINDER_STAND_INS)[number];

/**
 * Снять неотправленные уведомления типа `type` и поставить одно новое —
 * атомарно и для соседних инстансов.
 *
 * Хвост E16 (аудит 2026-11): перепланировка «снять, затем поставить» шла
 * двумя запросами. Внутри процесса порядок держит очередь
 * (src/utils/per-key-queue.ts), но полуночный обход на одном инстансе и
 * правка настроек на другом шли вперемешку, и в очереди оставалось два
 * напоминания. Теперь пара идёт в транзакции под advisory-локом на человека:
 * второй ждёт коммита первого и снимает уже его строку.
 *
 * Хвост волны 8: правка настроек решает «ставить напоминание» до лока. Если
 * за это время обход поставил вместо него сообщение дня (swapReminder),
 * напоминание не ставится — проверка под тем же локом видит его коммит.
 *
 * Лок транзакционный (снимается сам); совпадение hashtext — лишь очередь.
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
 * Что проверить под локом, прежде чем поставить сообщение дня. Хвост волны 9:
 * «такое уже стоит» спрашивали до лока — два обхода разом (ручной запуск
 * вместе с полуночным) не видели друг друга и ставили по сообщению.
 */
export interface SwapGuard {
  /** Такое уже стоит — второе не ставится, напоминание не трогается. */
  unlessPending?: boolean;
  /** Вопрос о плане этого дня — пока план не отмечен (missed-plan.ts). */
  openPlanDay?: string;
}

/**
 * Снять напоминание и поставить вместо него сообщение дня — под тем же локом
 * и в той же транзакции, что замена напоминания. Хвост волны 8: двумя
 * запросами правка настроек на соседнем инстансе вставала между ними, и в дне
 * оставалось напоминание рядом с сообщением о перерыве.
 */
export async function swapReminder(
  prisma: Db,
  userId: bigint,
  type: ReminderStandIn,
  sendAt: Date,
  payload?: object,
  guard: SwapGuard = {},
): Promise<void> {
  await underRescheduleLock(prisma, userId, async (tx) => {
    if (guard.unlessPending && (await isPending(tx, userId, type))) return;
    const day = guard.openPlanDay;
    if (day !== undefined && !(await hasOpenPlan(tx, userId, day))) return;
    await cancelPending(tx, userId, 'reminder');
    await createPending(tx, userId, type, sendAt, payload);
  });
}

/** Одна транзакция под локом перепланировки человека — у замен и у отметки
 *  плана (missed-plan.ts). */
export async function underRescheduleLock<T>(
  prisma: Db,
  userId: bigint,
  job: (tx: Tx) => Promise<T>,
): Promise<T> {
  return prisma.$transaction(async (tx) => {
    await lockReschedule(tx, userId);
    return job(tx);
  });
}

async function isPending(tx: Tx, userId: bigint, type: NotificationType) {
  const n = await tx.scheduledNotification.count({
    where: { userId, type, sentAt: null, cancelledAt: null },
  });
  return n > 0;
}

/** Есть неотмеченный план на день `day` (YYYY-MM-DD, местный день человека). */
export async function hasOpenPlan(tx: Tx, userId: bigint, day: string) {
  const n = await tx.practicePlan.count({
    where: { userId, scheduledDate: day, done: null },
  });
  return n > 0;
}

async function cancelPending(tx: Tx, userId: bigint, type: NotificationType) {
  await tx.scheduledNotification.updateMany({
    where: { userId, type, sentAt: null, cancelledAt: null },
    data: cancelledNow(),
  });
}

/** Заменитель, просроченный дольше этого, — хвост прошлого дня (очередь шлёт
 * каждые 5 минут): напоминание он не блокирует. */
const STALE_STAND_IN_MS = 60 * 60_000;

async function standInPending(tx: Tx, userId: bigint): Promise<boolean> {
  const n = await tx.scheduledNotification.count({
    where: {
      userId,
      type: { in: [...REMINDER_STAND_INS] },
      sentAt: null,
      cancelledAt: null,
      sendAt: { gte: new Date(Date.now() - STALE_STAND_IN_MS) },
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
 * Лок перепланировки одного человека до конца транзакции. Функция `void` —
 * `$executeRaw`, не `$queryRaw` (правило №18); живой прогон —
 * test/raw-sql-live-infra.e2e-spec.ts.
 */
export async function lockReschedule(
  tx: Pick<Prisma.TransactionClient, '$executeRaw'>,
  userId: bigint,
): Promise<void> {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`reschedule:${userId}`}))`;
}
