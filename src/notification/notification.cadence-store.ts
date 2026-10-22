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
 * Забрать локальный день пользователя под полуночный обход: `true` — день ещё
 * не планировали и теперь он наш, `false` — его уже спланировал прежний
 * (оборванный рестартом) или соседний прогон. Без этого доделка обхода после
 * рестарта давала уже обойдённому человеку второе проактивное уведомление за
 * день: `evaluate` повторно отвечает «не день напоминания», и planDay
 * проваливается в ветку `practice_missed`/инсайт (аудит 2026-10).
 *
 * Один UPDATE с условием: в Postgres из двух параллельных захватов строку
 * получает ровно один (test/midnight-planner-resume.e2e-spec.ts). OR с NULL
 * обязателен: `<> today` в SQL отбрасывает строки с NULL, и новичок, у
 * которого дня ещё не было, не получил бы ничего.
 *
 * Поле пишется и тем, кто на паузе (раньше его ставил только `evaluate`, до
 * которого пауза не доходит). Поведение от этого не меняется: читает поле
 * только `evaluate`, а merge/экспорт/реестр шифрования смотрят на тип, не на
 * смысл. День забирается ДО планирования: если `evaluate`/`schedule` упадут,
 * доделка этого человека в тот же день уже не повторит
 * (docs/open/backend.md, «Полуночный обход»).
 */
export async function claimPlanDay(
  prisma: PrismaService,
  user: Pick<CadenceUser, 'id' | 'notifyTimezone'>,
  now: Date,
): Promise<boolean> {
  const today = localDateString(user.notifyTimezone, now);
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
