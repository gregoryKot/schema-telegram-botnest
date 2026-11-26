import { PrismaService } from '../prisma/prisma.service';
import { encrypt, encryptJson } from '../utils/crypto';
import type { SessionWorkItem } from './session-work';

export interface NewSessionNote {
  date: string;
  text: string;
  work?: SessionWorkItem[];
  planItemIds?: number[];
}

/** Из присланных id остаются пункты этой пары; чужие и несуществующие отбрасываются молча. */
export async function ownedPlanItemIds(
  prisma: Pick<PrismaService, 'therapyPlanItem'>,
  therapistId: bigint,
  clientId: bigint,
  ids: number[] | undefined,
): Promise<number[]> {
  const uniq = [...new Set(ids ?? [])];
  if (uniq.length === 0) return [];
  const rows = await prisma.therapyPlanItem.findMany({
    where: { id: { in: uniq }, therapistId, clientId },
    select: { id: true },
  });
  const owned = new Set(rows.map((r) => r.id));
  return uniq.filter((id) => owned.has(id));
}

/** Запись итогов; ответ — открытым текстом. Отмеченные «planned» пункты плана становятся «active» там же. */
export async function createSessionNote(
  prisma: PrismaService,
  therapistId: bigint,
  clientId: bigint,
  body: NewSessionNote,
) {
  const work = body.work ?? [];
  const planItemIds = await ownedPlanItemIds(
    prisma,
    therapistId,
    clientId,
    body.planItemIds,
  );
  const note = await prisma.$transaction(async (tx) => {
    const created = await tx.therapistNote.create({
      data: {
        therapistId,
        clientId,
        date: body.date,
        text: encrypt(body.text) ?? body.text,
        planItemIds,
        // Пункты — шифротекст-строка в Json-колонке, как связи концептуализации; нет пунктов — [].
        ...(work.length > 0 && {
          work: encryptJson(work) ?? JSON.stringify(work),
        }),
      },
    });
    if (planItemIds.length > 0)
      await tx.therapyPlanItem.updateMany({
        where: {
          id: { in: planItemIds },
          therapistId,
          clientId,
          status: 'planned',
        },
        data: { status: 'active' },
      });
    return created;
  });
  return { ...note, text: body.text, work };
}
