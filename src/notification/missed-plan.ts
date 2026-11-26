// Вопрос о невыполненном плане (practice_missed, «Вчера был план: как
// получилось?») — о дне перед днём плана (шапка notification.planner.service.ts).
// Обход один, в 00:00 UTC: у Москвы с вечерним часом этот день к обходу уже
// кончился, у Владивостока и соседей (день плана — завтрашний) он ещё идёт —
// вопрос встаёт заранее, и снимает его отметка плана. Обе стороны — под локом
// перепланировки человека (replace-pending.ts): обход перепроверяет план под
// ним (SwapGuard.openPlanDay), отметка снимает уже поставленный вопрос.
import type { PrismaService } from '../prisma/prisma.service';
import { requireFound } from '../utils/require-affected';
import { cancelledNow } from './notification-payload.crypto';
import { addDaysLocal, localDateString } from './notification.time';
import { hasOpenPlan, underRescheduleLock } from './replace-pending';

type Db = Pick<PrismaService, '$transaction'>;

/**
 * Отметить план и снять вопрос о его дне, если других неотмеченных планов на
 * этот день нет. Вопрос о дне D обход ставит на день D+1 (день плана), по
 * местному дню отправки его и узнаём. Чужой или несуществующий план — 404.
 */
export async function checkinPlan(
  prisma: Db,
  userId: bigint,
  id: number,
  done: boolean,
): Promise<void> {
  await underRescheduleLock(prisma, userId, async (tx) => {
    const where = { id, userId };
    const select = { scheduledDate: true };
    const plan = await requireFound(
      tx.practicePlan.findFirst({ where, select }),
    );
    await tx.practicePlan.updateMany({
      where,
      data: { done, checkedAt: new Date() },
    });
    if (await hasOpenPlan(tx, userId, plan.scheduledDate)) return;
    const asked = await tx.scheduledNotification.findMany({
      where: {
        userId,
        type: 'practice_missed',
        sentAt: null,
        cancelledAt: null,
      },
      select: { id: true, sendAt: true },
    });
    if (asked.length === 0) return;
    const user = await tx.user.findUnique({
      where: { id: userId },
      select: { notifyTimezone: true },
    });
    const tz = user?.notifyTimezone ?? 'Europe/Moscow';
    const askDay = addDaysLocal(plan.scheduledDate, 1);
    const ids = asked
      .filter((n) => localDateString(tz, n.sendAt) === askDay)
      .map((n) => n.id);
    if (ids.length === 0) return;
    await tx.scheduledNotification.updateMany({
      where: { id: { in: ids }, sentAt: null, cancelledAt: null },
      data: cancelledNow(),
    });
  });
}
