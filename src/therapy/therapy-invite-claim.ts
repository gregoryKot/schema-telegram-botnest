import { PrismaService } from '../prisma/prisma.service';
import { isUniqueViolation } from '../prisma/unique-violation';

/**
 * Атомарный захват кода: find→update пропускал двух клиентов подряд на один
 * код (второй затирал первого). Условия — в самом UPDATE, выигрывает тот, у
 * кого count === 1 (T5). Два кода одного терапевта, применённые одним
 * клиентом одновременно: частичный unique TherapyRelation_active_pair_key
 * пропустил одного, для проигравшего (23505) это ветка «уже подключён» → true.
 * `dropAlias`: до сверки (S8) связь живёт без имени офлайн-карточки.
 */
export async function claimTherapyInvite(
  prisma: PrismaService,
  code: string,
  clientId: bigint,
  dropAlias = false,
): Promise<boolean> {
  const alias = dropAlias ? { clientAlias: null } : {};
  try {
    const claimed = await prisma.therapyRelation.updateMany({
      where: {
        code,
        status: 'pending',
        clientId: null,
        therapistId: { not: clientId },
      },
      data: { clientId, status: 'active', ...alias },
    });
    return claimed.count === 1;
  } catch (e) {
    if (isUniqueViolation(e)) return true;
    throw e;
  }
}
