// `shown`-модели выгрузки клиента: та же выборка и тот же вид, что у экрана
// кабинета (что видит — то и выгружает). Решение «shown» — в export-policy.client.ts.
import type { PrismaService } from '../prisma/prisma.service';
import { clientConceptView } from '../therapy/client-concept-view';
import { clientMapAuthors } from '../therapy/client-map-authors';
import { clientModeMapView, MODE_MAP_SCHEMA } from '../therapy/client-mode-map';

/** `shown`-модели: та же выборка и тот же вид, что у экрана (что видит — то и выгружает). */
export const SHOWN_EXPORTS: Record<
  string,
  (prisma: PrismaService, clientId: bigint) => Promise<object[]>
> = {
  ClientConceptualization: async (prisma, clientId) => {
    const rows = await prisma.clientConceptualization.findMany({
      where: { clientId, sharedWithClientAt: { not: null } },
    });
    return rows
      .map(clientConceptView)
      .filter((v): v is NonNullable<typeof v> => v !== null);
  },
  ModeMap: async (prisma, clientId) => {
    const authors = await clientMapAuthors(prisma, clientId);
    const rows = await prisma.modeMap.findMany({
      where: { clientId, therapistId: { in: authors } },
      orderBy: { updatedAt: 'desc' },
    });
    const out: object[] = [];
    for (const row of rows)
      out.push(await clientModeMapView(prisma, row, MODE_MAP_SCHEMA));
    return out;
  },
};
