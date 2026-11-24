// Стили копинга клиента со схемой (#1484, «Про клиента» из «Справочника»): поля
// `coping` и `copingNotes` связи схемы (ConceptSchemaLink). Отметка ложится в
// схему случая: схемы там нет — добавляется вместе с отметкой; снятие убирает
// стиль и его заметку, схема остаётся.
import type { ConceptSchemaLink } from '../../apiTypes';
import { CONCEPT_COPING_NOTE_MAX } from '../../limits/textLimits';
import {
  COPING_STYLES,
  type CopingStyleId,
} from '../../schemaTherapy/guide/copingStyles';
import { findSchemaLink } from './schemaLinks';

const IDS: readonly CopingStyleId[] = COPING_STYLES.map((s) => s.id);

export type CopingNotes = Partial<Record<CopingStyleId, string>>;

/** Стили в порядке справочника, без дублей и чужих строк. */
export function normalizeCoping(raw: unknown): CopingStyleId[] {
  if (!Array.isArray(raw)) return [];
  return IDS.filter((id) => raw.includes(id));
}

/** Поля копинга для нормализованной связи: пустое не пишется, заметка — только у отмеченного стиля. */
export function copingFields(
  r: Record<string, unknown>,
): Pick<ConceptSchemaLink, 'coping' | 'copingNotes'> {
  const coping = normalizeCoping(r.coping);
  if (coping.length === 0) return {};
  const raw = (
    typeof r.copingNotes === 'object' && r.copingNotes !== null
      ? r.copingNotes
      : {}
  ) as Record<string, unknown>;
  const notes: CopingNotes = {};
  for (const id of coping) {
    const v = raw[id];
    if (typeof v === 'string' && v.trim() !== '') notes[id] = v;
  }
  return Object.keys(notes).length > 0
    ? { coping, copingNotes: notes }
    : { coping };
}

export function isCopingMarked(
  link: ConceptSchemaLink,
  style: CopingStyleId,
): boolean {
  return link.coping?.includes(style) ?? false;
}

export interface CopingSource {
  schemaIds: string[];
  schemaLinks: ConceptSchemaLink[];
}

export interface CopingChange {
  link: ConceptSchemaLink;
  /** Схема добавлена в схему случая вместе с отметкой. */
  addedSchema: boolean;
  /** Стиль поставлен впервые (а не поправлена заметка). */
  addedStyle: boolean;
}

/** Отметить стиль или поправить его заметку; пустая заметка — без заметки. */
export function markCoping(
  src: CopingSource,
  schemaId: string,
  style: CopingStyleId,
  note: string,
): CopingChange {
  const cur = findSchemaLink(src.schemaLinks, schemaId);
  const addedStyle = !isCopingMarked(cur, style);
  const coping = normalizeCoping([...(cur.coping ?? []), style]);
  const notes: CopingNotes = { ...cur.copingNotes };
  const text = note.trim().slice(0, CONCEPT_COPING_NOTE_MAX);
  if (text) notes[style] = text;
  else delete notes[style];
  const link: ConceptSchemaLink = { ...cur, coping, copingNotes: notes };
  if (Object.keys(notes).length === 0) delete link.copingNotes;
  return {
    link,
    addedSchema: !src.schemaIds.includes(schemaId),
    addedStyle,
  };
}

/** Снять стиль: уходит и его заметка, схема остаётся в схеме случая. */
export function unmarkCoping(
  links: ConceptSchemaLink[],
  schemaId: string,
  style: CopingStyleId,
): ConceptSchemaLink {
  const cur = findSchemaLink(links, schemaId);
  const link: ConceptSchemaLink = { ...cur };
  const coping = (cur.coping ?? []).filter((s) => s !== style);
  const notes: CopingNotes = { ...cur.copingNotes };
  delete notes[style];
  if (coping.length > 0) link.coping = coping;
  else delete link.coping;
  if (Object.keys(notes).length > 0) link.copingNotes = notes;
  else delete link.copingNotes;
  return link;
}
