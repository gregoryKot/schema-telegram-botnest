import { PrismaService } from '../prisma/prisma.service';

// Терапевты, чьи карты режимов клиент видит у себя (my-mode-maps).
// `active` — да. `ended` — тоже: так связь закрывает только отказ терапевта от
// роли (end-therapist-relations.ts), и карты остаются у клиента как история
// (решение владельца 2026-10-22, #865). Строки связи нет — клиент отключился
// сам (disconnect удаляет живые связи) — карт этого терапевта в кабинете нет;
// удаление клиента терапевтом стирает карты целиком (removeTherapistClient).
export async function clientMapAuthors(
  prisma: PrismaService,
  clientId: bigint,
): Promise<bigint[]> {
  const rels = await prisma.therapyRelation.findMany({
    where: { clientId, status: { in: ['active', 'ended'] } },
    select: { therapistId: true },
  });
  return rels.map((r) => r.therapistId);
}

// Карта принадлежит клиенту, и её автор — среди clientMapAuthors.
export async function clientSeesMap(
  prisma: PrismaService,
  clientId: bigint,
  map: { clientId: bigint; therapistId: bigint },
): Promise<boolean> {
  if (map.clientId.toString() !== clientId.toString()) return false;
  const authors = await clientMapAuthors(prisma, clientId);
  return authors.some((t) => t.toString() === map.therapistId.toString());
}
