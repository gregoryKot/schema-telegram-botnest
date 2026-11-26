import type { ClientMeeting } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { isUniqueViolation } from '../prisma/unique-violation';
import { clientKeyCandidates } from './client-key';

// Поиск постоянной комнаты клиента (вынесен из meeting.service.ts, правило
// №10). Ищется только по HMAC-ключам контакта (client-key.ts): старая формула
// склеивала разные ящики, и поиск по ней вернул бы склейку. Строки старого
// формата переводит client-key-rekey.service.ts на старте приложения.

/** Есть ли у контакта постоянная комната (клиент возвращается). */
export async function hasClientMeeting(
  prisma: PrismaService,
  contact: string,
): Promise<boolean> {
  const n = await prisma.clientMeeting.count({
    where: { clientKey: { in: clientKeyCandidates(contact) } },
  });
  return n > 0;
}

/**
 * Строка ClientMeeting контакта. Найдена под ключом ENCRYPTION_KEY_OLD (окно
 * ротации) — переносится на текущий ключ условно, по ключу и шифротексту
 * ссылки: два одновременных подтверждения не плодят строк, проигравший берёт
 * строку победителя.
 */
export async function findClientMeeting(
  prisma: PrismaService,
  contact: string,
): Promise<ClientMeeting | null> {
  const keys = clientKeyCandidates(contact);
  const rows = await prisma.clientMeeting.findMany({
    where: { clientKey: { in: keys } },
  });
  const own = rows.find((r) => r.clientKey === keys[0]);
  if (own || rows.length === 0) return own ?? null;
  return moveToKey(prisma, rows[0], keys[0]);
}

async function moveToKey(
  prisma: PrismaService,
  row: ClientMeeting,
  key: string,
): Promise<ClientMeeting | null> {
  const reread = async () =>
    (await prisma.clientMeeting.findUnique({ where: { clientKey: key } })) ??
    prisma.clientMeeting.findUnique({ where: { clientKey: row.clientKey } });
  try {
    const res = await prisma.clientMeeting.updateMany({
      where: { clientKey: row.clientKey, meetingUrl: row.meetingUrl },
      data: { clientKey: key },
    });
    return res.count > 0 ? { ...row, clientKey: key } : reread();
  } catch (e) {
    // Строку под текущим ключом уже записал сосед — берём её.
    if (isUniqueViolation(e)) return reread();
    throw e;
  }
}
