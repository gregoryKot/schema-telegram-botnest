import type { PrismaService } from '../prisma/prisma.service';
import type { CadenceUser } from './notification.cadence.service';
import { localDateString } from './notification.time';

// Запросы движка частоты (notification.cadence.service.ts) к строке User,
// которым не нужна остальная логика сервиса. Вынесено отдельным модулем, чтобы
// сервис не пробил свой потолок размера (правило №10).

/** Поля User, из которых собирается CadenceUser. */
export const CADENCE_USER_SELECT = {
  id: true,
  notifyTimezone: true,
  notifyFrequency: true,
  notifyAdaptiveLevel: true,
  notifyIgnoredCount: true,
  notifyNextRemindDate: true,
  notifySkipAckDate: true,
  notifyLastEvalDate: true,
  notifyPausedUntil: true,
} as const;

/**
 * Забрать день плана под полуночный обход (`planDate`, E13 — шапка
 * планировщика; без него — местный день на момент now): `true` — день ещё
 * не планировали и теперь он наш, `false` — его уже спланировал прежний
 * (оборванный рестартом) или соседний прогон. Без этого доделка обхода после
 * рестарта давала уже обойдённому человеку второе проактивное уведомление за
 * день: `evaluate` повторно отвечает «не день напоминания», и planDay
 * проваливался в `practice_missed`/инсайт (аудит 2026-10).
 *
 * Один UPDATE с условием: в Postgres из двух параллельных захватов строку
 * получает ровно один (test/midnight-planner-resume.e2e-spec.ts). OR с NULL
 * обязателен: `<> today` в SQL отбрасывает NULL — новичок остался бы без дня.
 *
 * Поле пишется и тем, кто на паузе (раньше его ставил только `evaluate`, до
 * которого пауза не доходит). Поведение от этого не меняется: читает поле
 * только `evaluate`, а merge/экспорт/реестр шифрования смотрят на тип, не на
 * смысл. День забирается ДО планирования: если `evaluate`/`schedule` упадут,
 * доделка этого человека его уже не повторит (docs/open/backend.md).
 */
export async function claimPlanDay(
  prisma: PrismaService,
  user: Pick<CadenceUser, 'id' | 'notifyTimezone'>,
  now: Date,
  planDate?: string,
): Promise<boolean> {
  const today = planDate ?? localDateString(user.notifyTimezone, now);
  const { count } = await prisma.user.updateMany({
    where: {
      id: user.id,
      OR: [
        { notifyLastEvalDate: null },
        { notifyLastEvalDate: { not: today } },
      ],
    },
    data: { notifyLastEvalDate: today },
  });
  return count === 1;
}

/**
 * Забрать день заполнения трекера: `true` — заполнение за `day` отрабатывает
 * впервые (сводка, вехи, «с возвращением»), `false` — день уже забрал другой
 * вызов. E16 (аудит 2026-11): два параллельных сохранения последних оценок
 * оба видели день заполненным, оба снимали и ставили сводку — вперемешку
 * выходило две. Тот же приём, что у claimPlanDay: один UPDATE с условием,
 * OR с NULL обязателен.
 */
export async function claimFillDay(
  prisma: PrismaService,
  userId: bigint,
  day: string,
): Promise<boolean> {
  const { count } = await prisma.user.updateMany({
    where: {
      id: userId,
      OR: [{ notifyLastFillDate: null }, { notifyLastFillDate: { not: day } }],
    },
    data: { notifyLastFillDate: day },
  });
  return count === 1;
}
