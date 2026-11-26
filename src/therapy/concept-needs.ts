// Запись колеса потребностей клиента (POST /api/therapy/conceptualization/
// :clientId/needs). Холст «Графических карт» шлёт колесо ЦЕЛИКОМ: replace,
// последний пишет — потребность, которой нет в теле, из колеса уходит.
// Остальные поля концептуализации запись не трогает, снимок в историю версий
// не кладёт (колесо в историю не входит — concept-need-links.ts). Версия
// строки (updatedAt) при этом сдвигается, как у дописывания с холста
// (concept-append.ts): вкладка «Концептуализация» со старой baseVersion получит
// 409, перечитает строку и повторит свои правки.
import type { PrismaService } from '../prisma/prisma.service';
import { inSerializableTx } from '../prisma/serializable-retry';
import type { TherapyRelationsService } from './therapy-relations.service';
import { conceptView } from './concept-store';
import { conceptStale } from './concept-save';
import { encryptNeedLinks, normalizeNeedLinks } from './concept-need-links';

/**
 * Проверяет связь с клиентом (чужому — 'No active relation'), нормализует
 * колесо (дубль потребности — остаётся первая запись) и пишет его шифротекстом.
 * Строки концептуализации ещё нет — создаётся пустая с колесом. Serializable,
 * как у сохранения с версией и дописывания: конкурентная запись той же строки
 * не теряется молча, а повторяется. Ответ — концептуализация целиком.
 */
export async function saveConceptNeeds(
  deps: {
    prisma: PrismaService;
    relations: Pick<TherapyRelationsService, 'assertHasClient'>;
  },
  key: { therapistId: bigint; clientId: bigint },
  links: unknown,
) {
  await deps.relations.assertHasClient(key.therapistId, key.clientId);
  const needLinks = encryptNeedLinks(normalizeNeedLinks(links));
  return inSerializableTx(
    deps.prisma,
    async (tx) => {
      const row = await tx.clientConceptualization.upsert({
        where: { therapistId_clientId: key },
        create: { ...key, needLinks },
        update: { needLinks },
      });
      return conceptView(row, row.history);
    },
    conceptStale,
  );
}
