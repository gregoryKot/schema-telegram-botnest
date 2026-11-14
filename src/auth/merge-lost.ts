// Строка переносимого аккаунта, у которой у цели есть строка с тем же
// уникальным ключом, удаляется шагом DELETE…EXISTS из UNIQUE_RULES без
// объединения (таблицы вне COMBINERS). Экран слияния называет такие потери
// заранее; пары ищет тот же pairs(), что и объединение.
import { Logger } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { pairs } from './merge-combine';

export type LostDb = Pick<
  Prisma.TransactionClient,
  'rating' | 'childhoodRating' | 'ysqProgress' | 'therapistRequest'
>;

type Counter = (db: LostDb, src: bigint, tgt: bigint) => Promise<number>;

const both = (src: bigint, tgt: bigint) => ({ userId: { in: [src, tgt] } });

const rating: Counter = async (db, src, tgt) => {
  const rows = await db.rating.findMany({
    where: both(src, tgt),
    select: { userId: true, date: true, needId: true },
  });
  return pairs(rows, src, (r) => `${r.date}|${r.needId}`).length;
};

const childhoodRating: Counter = async (db, src, tgt) => {
  const rows = await db.childhoodRating.findMany({
    where: both(src, tgt),
    select: { userId: true, needId: true },
  });
  return pairs(rows, src, (r) => r.needId).length;
};

const ysqProgress: Counter = async (db, src, tgt) => {
  const rows = await db.ysqProgress.findMany({
    where: both(src, tgt),
    select: { userId: true },
  });
  return pairs(rows, src, () => '').length;
};

const therapistRequest: Counter = async (db, src, tgt) => {
  const rows = await db.therapistRequest.findMany({
    where: both(src, tgt),
    select: { userId: true },
  });
  return pairs(rows, src, () => '').length;
};

/** Таблицы UNIQUE_RULES, где строка источника при совпадении ключа теряется. */
export const LOST_ON_CONFLICT = {
  Rating: rating,
  ChildhoodRating: childhoodRating,
  YsqProgress: ysqProgress,
  TherapistRequest: therapistRequest,
} satisfies Record<string, Counter>;

/** Тоже удаляются без объединения, но на экран не выносятся — почему. */
export const LOST_UNSHOWN: Record<string, string> = {
  AppActivity:
    'отметка «был в приложении в этот день»: у цели за тот же день своя, день не теряется',
  DiaryDraft:
    'таблица без писателя (черновики в localStorage), у цели свой черновик того же типа',
};

const logger = new Logger('MergeLost');

/** Сколько строк источника удалится без объединения, по таблицам; только n > 0. */
export async function countLost(
  db: LostDb,
  src: bigint,
  tgt: bigint,
): Promise<Record<string, number>> {
  const lost: Record<string, number> = {};
  for (const [table, count] of Object.entries(LOST_ON_CONFLICT)) {
    try {
      const n = await count(db, src, tgt);
      if (n > 0) lost[table] = n;
    } catch (err) {
      logger.error(`countLost ${table}: ${(err as Error).message}`);
    }
  }
  return lost;
}
