import { NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { decrypt } from '../utils/crypto';
import { readNoteWork } from './session-work-list';

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
    notes: rows.map((r) => ({
      ...r,
      text: decrypt(r.text) ?? r.text,
      work: readNoteWork(r.work),
    })),
    total,
  };
}

/** Одна запись сессии и её номер «Сессия N» (порядок — обратный SESSION_NOTES_ORDER);
 * 404 — записи нет у этой пары. Так открывают запись, не попавшую в страницу. */
export async function findSessionNote(
  prisma: PrismaService,
  therapistId: bigint,
  clientId: bigint,
  noteId: number,
) {
  const where = { therapistId, clientId };
  const row = await prisma.therapistNote.findFirst({
    where: { ...where, id: noteId },
  });
  if (!row) throw new NotFoundException('Note not found');
  const earlier = await prisma.therapistNote.count({
    where: {
      ...where,
      OR: [
        { date: { lt: row.date } },
        { date: row.date, createdAt: { lt: row.createdAt } },
        { date: row.date, createdAt: row.createdAt, id: { lt: row.id } },
      ],
    },
  });
  return {
    note: {
      ...row,
      text: decrypt(row.text) ?? row.text,
      work: readNoteWork(row.work),
    },
    number: earlier + 1,
  };
}
