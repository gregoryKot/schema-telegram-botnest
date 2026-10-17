import { PrismaService } from '../prisma/prisma.service';
import { isUniqueViolation } from '../prisma/unique-violation';

/**
 * Атомарный захват кода: find→update пропускал двух клиентов подряд на один
 * код (второй затирал первого). Условия — в самом UPDATE, выигрывает тот, у
 * кого count === 1 (T5).
 *
 * Два кода одного терапевта, применённые одним клиентом одновременно:
 * `alreadyConnected` в joinTherapyAsClient обоих пропустил, а частичный unique
 * TherapyRelation_active_pair_key пропустил одного. Для проигравшего (23505)
 * это ровно ветка «уже подключён» → true.
 */
export async function claimTherapyInvite(
  prisma: PrismaService,
  code: string,
  clientId: bigint,
): Promise<boolean> {
  try {
    const claimed = await prisma.therapyRelation.updateMany({
      where: {
        code,
        status: 'pending',
        clientId: null,
        therapistId: { not: clientId },
      },
      data: { clientId, status: 'active' },
    });
    return claimed.count === 1;
  } catch (e) {
    if (isUniqueViolation(e)) return true;
    throw e;
  }
}
