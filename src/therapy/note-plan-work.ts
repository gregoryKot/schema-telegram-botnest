import { PrismaService } from '../prisma/prisma.service';
import { SESSION_WORK_NOTES_MAX } from './session-work-list';

export interface NotePlanWorkEntry {
  noteId: number;
  /** День сессии, `YYYY-MM-DD` (как `date` заметки). */
  date: string;
  planItemIds: number[];
}

/** Пункты плана, над которыми работали на сессиях, по всем записям пары; новые сверху. */
export async function findNotePlanWork(
  prisma: PrismaService,
  therapistId: bigint,
  clientId: bigint,
): Promise<{ entries: NotePlanWorkEntry[] }> {
  const rows = await prisma.therapistNote.findMany({
    where: { therapistId, clientId },
    select: { id: true, date: true, planItemIds: true },
    orderBy: [{ date: 'desc' }, { id: 'desc' }],
    take: SESSION_WORK_NOTES_MAX,
  });
  return {
    entries: rows
      .filter((r) => r.planItemIds.length > 0)
      .map((r) => ({ noteId: r.id, date: r.date, planItemIds: r.planItemIds })),
  };
}
