import { PrismaService } from '../prisma/prisma.service';
import { isUniqueViolation } from '../prisma/unique-violation';

/**
 * Активирует pending-пару за вступающего `uid`. true — они в активной паре
 * (в том числе уже были); false — слот занят кем-то другим.
 *
 * Эти двое могут быть в паре уже (B вступил по коду A, теперь A вступает по
 * коду B): вторая активная строка (B,A) показывала бы партнёра дважды, поэтому
 * для вступающего это успех — как «уже подключён» у терапевта. Две такие
 * вставки одновременно разводит частичный unique-индекс Pair_active_users_key:
 * проигравший получает 23505, что для него та же ветка «уже в паре».
 */
export async function activatePair(
  prisma: PrismaService,
  uid: bigint,
  pair: { code: string; userId1: bigint },
): Promise<boolean> {
  const already = await prisma.pair.findFirst({
    where: {
      status: 'active',
      OR: [
        { userId1: pair.userId1, userId2: uid },
        { userId1: uid, userId2: pair.userId1 },
      ],
    },
  });
  if (already) return true;
  // Conditional update — atomic at the DB level. If two users race to join
  // the same code, only the one whose UPDATE still matches `pending` + empty
  // slot wins; the loser gets count 0.
  try {
    const res = await prisma.pair.updateMany({
      where: { code: pair.code, status: 'pending', userId2: null },
      data: { userId2: uid, status: 'active' },
    });
    return res.count === 1;
  } catch (e) {
    if (isUniqueViolation(e)) return true;
    throw e;
  }
}
