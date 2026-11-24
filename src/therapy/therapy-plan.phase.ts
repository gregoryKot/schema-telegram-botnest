import { NotFoundException } from '@nestjs/common';
import type { PrismaService } from '../prisma/prisma.service';

/** Пункт плана привязывается только к фазе пути своей же пары; иначе 404. */
export async function assertPhaseOfPair(
  prisma: Pick<PrismaService, 'therapyPath' | 'therapyPathPhase'>,
  pair: { therapistId: bigint; clientId: bigint },
  phaseId: number,
): Promise<void> {
  const phase = await prisma.therapyPathPhase.findFirst({
    where: { id: phaseId },
    select: { pathId: true },
  });
  const path =
    phase &&
    (await prisma.therapyPath.findFirst({
      where: {
        id: phase.pathId,
        therapistId: pair.therapistId,
        clientId: pair.clientId,
      },
      select: { id: true },
    }));
  if (!path) throw new NotFoundException('Phase not found');
}
