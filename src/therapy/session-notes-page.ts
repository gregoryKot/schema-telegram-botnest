import { PrismaService } from '../prisma/prisma.service';
import { decrypt } from '../utils/crypto';

// Сколько заметок отдаётся за раз; остальное фронт узнаёт из total.
export const SESSION_NOTES_PAGE = 100;

// Порядок среза обратен нумерации «Сессия N» на фронте (compareNotesAsc в
// shared/src/therapy/notesPage.ts: date, createdAt, id по возрастанию), поэтому
// отрезаются самые ранние по номеру сессии и номер показанной заметки считается
// от total. Заметка с ранней датой, внесённая последней, не вытесняет свежие.
export const SESSION_NOTES_ORDER = [
  { date: 'desc' },
  { createdAt: 'desc' },
  { id: 'desc' },
] as const;

export async function findSessionNotesPage(
  prisma: PrismaService,
  therapistId: bigint,
  clientId: bigint,
) {
  const where = { therapistId, clientId };
  const [rows, total] = await Promise.all([
    prisma.therapistNote.findMany({
      where,
      orderBy: [...SESSION_NOTES_ORDER],
      take: SESSION_NOTES_PAGE,
    }),
    prisma.therapistNote.count({ where }),
  ]);
  return {
    notes: rows.map((r) => ({ ...r, text: decrypt(r.text) ?? r.text })),
    total,
  };
}
