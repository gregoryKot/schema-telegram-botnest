import type { TherapistNote } from '../../api';

/** Порядковый номер сессии для каждой заметки: по дате (старее — меньше), при равной дате — по времени создания и id. */
export function sessionNumbers(notes: Pick<TherapistNote, 'id' | 'date' | 'createdAt'>[]): Map<number, number> {
  const sorted = notes.slice().sort((a, b) =>
    a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt) || a.id - b.id);
  return new Map(sorted.map((n, i) => [n.id, i + 1]));
}
