import { PrismaService } from '../prisma/prisma.service';
import { decryptJson } from '../utils/crypto';
import { normalizeSessionWork, type SessionWorkItem } from './session-work';

// Потолок записей за один ответ: журнал «На сессиях» читает пункты всех
// сессий клиента, страница заметок (session-notes-page.ts) отдаёт только 100.
export const SESSION_WORK_NOTES_MAX = 2000;

export interface SessionWorkEntry {
  noteId: number;
  /** День сессии, `YYYY-MM-DD`. */
  date: string;
  work: SessionWorkItem[];
}

/** Колонка `work` → пункты: шифротекст-строка; [] по умолчанию и старые записи — пунктов нет. */
export function readNoteWork(raw: unknown): SessionWorkItem[] {
  return normalizeSessionWork(typeof raw === 'string' ? decryptJson(raw) : raw);
}

/** Пункты «Что делали» по всем записям клиента, новые сессии сверху; записи без пунктов не отдаются. */
export async function findSessionWork(
  prisma: PrismaService,
  therapistId: bigint,
  clientId: bigint,
): Promise<{ entries: SessionWorkEntry[] }> {
  const rows = await prisma.therapistNote.findMany({
    where: { therapistId, clientId },
    select: { id: true, date: true, work: true },
    orderBy: [{ date: 'desc' }, { id: 'desc' }],
    take: SESSION_WORK_NOTES_MAX,
  });
  const entries: SessionWorkEntry[] = [];
  for (const r of rows) {
    const work = readNoteWork(r.work);
    if (work.length > 0) entries.push({ noteId: r.id, date: r.date, work });
  }
  return { entries };
}
