import { PrismaService } from '../prisma/prisma.service';
import { CLIENT_LEFT, THERAPIST_REMOVED } from './relation-end-reason';

// Терапевты, чьи карты режимов клиент видит у себя (my-mode-maps).
// `active` — да. `ended` после отказа терапевта от роли — тоже: карты
// остаются у клиента как история (решение владельца 2026-10-22, #865).
// Клиент отключился сам (client_left) — карт этого терапевта в кабинете нет,
// как было, пока disconnect удалял строку; удаление клиента терапевтом
// (therapist_removed) стирает карты целиком (removeTherapistClient).
export async function clientMapAuthors(
  prisma: PrismaService,
  clientId: bigint,
): Promise<bigint[]> {
  const rels = await prisma.therapyRelation.findMany({
    where: { clientId, status: { in: ['active', 'ended'] } },
    select: { therapistId: true, status: true, endReason: true },
  });
  return rels
    .filter((r) => r.status === 'active' || !CLOSED.has(r.endReason ?? ''))
    .map((r) => r.therapistId);
}

// Завершения, после которых карты бывшего терапевта клиенту не показываются.
const CLOSED = new Set<string>([CLIENT_LEFT, THERAPIST_REMOVED]);

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
