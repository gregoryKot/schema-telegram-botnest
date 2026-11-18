// Журнал «На сессиях» из двух источников (#1330): отметки «Делали сегодня»
// связей концептуализации (techniqueJournal) и пункты «Что делали» записей
// сессий. Собирается при чтении, двойной записи нет. Чистые функции без React.
import type { ConceptModeLink, ConceptTechniqueMark } from '../../apiTypes';
import {
  getModeById,
  getSchemaById,
} from '../../schemaTherapy/schemaTherapyData';
import type { GuideFrom } from '../conceptGraph/conceptGuide';
import { modeName } from '../conceptGraph/conceptDigestModel';
import type { TechniqueJournalEntry } from '../conceptGraph/techniqueJournal';
import { hiddenCount, type TherapistNotesPage } from '../notesPage';
import { normalizeSessionWork } from './normalize';
import type { SessionWorkEntry, SessionWorkItem } from './types';

/**
 * Пункты всех сессий клиента: показанные заметки — из страницы (она знает о
 * только что сохранённых и удалённых), более ранние, которых страница не
 * держит, — из ответа ручки пунктов (`older`; не загружен — null).
 */
export function sessionWorkEntries(
  page: TherapistNotesPage,
  older: readonly SessionWorkEntry[] | null,
): SessionWorkEntry[] {
  const out: SessionWorkEntry[] = [];
  for (const n of page.notes) {
    const work = normalizeSessionWork(n.work);
    if (work.length > 0) out.push({ noteId: n.id, date: n.date, work });
  }
  if (hiddenCount(page) === 0) return out;
  const shown = new Set(page.notes.map((n) => n.id));
  for (const e of older ?? []) if (!shown.has(e.noteId)) out.push(e);
  return out;
}

export interface WorkJournalEntry {
  day: string;
  noteId: number;
  item: SessionWorkItem;
}

export type JournalRow =
  | ({ source: 'mark' } & TechniqueJournalEntry)
  | ({ source: 'work' } & WorkJournalEntry);

export interface SessionJournalDay {
  day: string;
  rows: JournalRow[];
}

const fromIds = (item: SessionWorkItem, kind: GuideFrom['kind']) =>
  kind === 'mode' ? item.modeIds : item.schemaIds;

/** Пункт итогов — та же техника с тем же режимом или схемой, что у отметки. */
const covers = (item: SessionWorkItem, mark: TechniqueJournalEntry) =>
  item.kind === 'technique' &&
  item.refId === mark.techniqueId &&
  fromIds(item, mark.from.kind).includes(mark.from.id);

/**
 * Журнал по дням, новые сверху: в дне сначала пункты итогов сессий, затем
 * отметки. Отметка, у которой в тот же день есть пункт с той же техникой и
 * тем же режимом или схемой, не двоится — остаётся пункт (он ведёт к записи).
 */
export function sessionJournal(
  marks: readonly TechniqueJournalEntry[],
  entries: readonly SessionWorkEntry[],
): SessionJournalDay[] {
  const rows: JournalRow[] = [];
  for (const e of entries)
    for (const item of e.work)
      rows.push({ source: 'work', day: e.date, noteId: e.noteId, item });
  const work = rows.slice() as (JournalRow & { source: 'work' })[];
  for (const m of marks) {
    const dup = work.some((w) => w.day === m.day && covers(w.item, m));
    if (!dup) rows.push({ source: 'mark', ...m });
  }
  // Сортировка устойчивая: внутри дня пункты стоят перед отметками.
  rows.sort((a, b) => (a.day < b.day ? 1 : a.day > b.day ? -1 : 0));
  const days: SessionJournalDay[] = [];
  for (const row of rows) {
    const last = days[days.length - 1];
    if (last?.day === row.day) last.rows.push(row);
    else days.push({ day: row.day, rows: [row] });
  }
  return days;
}

/**
 * С чем работали в пункте, строкой: режимы (со словами клиента, как в
 * «Коротко»), свои режимы терапевта (`customModes`) и схемы. Чего нет в
 * справочнике и среди своих — пропускается.
 */
export function workFromNames(
  item: SessionWorkItem,
  modeLinks: readonly ConceptModeLink[] = [],
  customModes: readonly { id: string; name: string }[] = [],
): string {
  const modes = item.modeIds.map((id) => {
    const name = (getModeById(id) ?? customModes.find((m) => m.id === id))
      ?.name;
    const alias = modeLinks.find((l) => l.modeId === id)?.alias.trim() ?? '';
    return name && modeName({ name, alias });
  });
  const schemas = item.schemaIds.map((id) => getSchemaById(id)?.name);
  return [...modes, ...schemas].filter(Boolean).join(', ');
}

/** Дни из итогов сессий, когда технику делали с этим режимом или схемой, — для листа техники. */
export function workMarks(
  entries: readonly SessionWorkEntry[],
  from: GuideFrom,
): ConceptTechniqueMark[] {
  const out: ConceptTechniqueMark[] = [];
  for (const e of entries)
    for (const item of e.work)
      if (
        item.kind === 'technique' &&
        item.refId &&
        fromIds(item, from.kind).includes(from.id)
      )
        out.push({ techniqueId: item.refId, day: e.date });
  return out;
}
