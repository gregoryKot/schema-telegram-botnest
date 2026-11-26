import { PrismaService } from '../prisma/prisma.service';
import { decrypt, decryptJson } from '../utils/crypto';
import { localDate } from '../utils/tz';
import { userTimezone } from '../bot/user-tz';

// Лента дневника клиента у терапевта: последние записи схем, режимов и
// благодарности одним списком. Вынесено из therapy-client-data.service.ts
// (правило №10); доступ (assertHasClient, therapistShareCards) сервис
// проверяет ДО вызова.
//
// Дата записи — местный день клиента (E15 аудита 2026-11). Дневники схем и
// режимов хранят момент createdAt, и день брался в UTC: запись в 01:30 по
// Москве стояла вчерашним числом, рядом с благодарностью, у которой день —
// календарь самого клиента.

export interface ClientDiaryEntry {
  type: 'schema' | 'mode' | 'gratitude';
  date: string;
  schemaIds?: string[];
  modeId?: string;
  excerpt: string;
}

const LIMIT = 10;

/** Список строк: зашифрованный JSON (новые записи) или массив (старые). */
function stringList(value: unknown): string[] {
  return typeof value === 'string'
    ? (decryptJson<string[]>(value) ?? [])
    : ((value as string[]) ?? []);
}

export async function readClientDiaryEntries(
  prisma: PrismaService,
  userId: bigint,
): Promise<ClientDiaryEntry[]> {
  const [tz, schemaRows, modeRows, gratitudeRows] = await Promise.all([
    userTimezone(prisma, userId),
    prisma.schemaDiaryEntry.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: LIMIT,
      select: { schemaIds: true, trigger: true, createdAt: true },
    }),
    prisma.modeDiaryEntry.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: LIMIT,
      select: { modeId: true, situation: true, createdAt: true },
    }),
    prisma.gratitudeDiaryEntry.findMany({
      where: { userId },
      orderBy: { date: 'desc' },
      take: LIMIT,
      select: { date: true, items: true },
    }),
  ]);

  const entries: (ClientDiaryEntry & { dateMs: number })[] = [
    ...schemaRows.map((r) => ({
      type: 'schema' as const,
      dateMs: r.createdAt.getTime(),
      date: localDate(tz, r.createdAt),
      schemaIds: stringList(r.schemaIds),
      excerpt: decrypt(r.trigger) ?? r.trigger,
    })),
    ...modeRows.map((r) => ({
      type: 'mode' as const,
      dateMs: r.createdAt.getTime(),
      date: localDate(tz, r.createdAt),
      modeId: decrypt(r.modeId) ?? r.modeId,
      excerpt: decrypt(r.situation) ?? r.situation,
    })),
    ...gratitudeRows.map((r) => ({
      type: 'gratitude' as const,
      // `Z` обязателен: без него день уезжал в зону сервера (инцидент 2026-09-17)
      dateMs: Date.parse(r.date + 'T00:00:00Z'),
      date: r.date,
      excerpt: stringList(r.items).slice(0, 2).join(' · '),
    })),
  ];

  return entries
    .sort((a, b) => b.dateMs - a.dateMs)
    .slice(0, LIMIT)
    .map(({ dateMs: _d, ...rest }) => rest);
}
