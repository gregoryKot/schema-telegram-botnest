import { SCHEMA_DOMAINS, getModeById } from '../../schemaTherapyData';

export type NoteKind = 'schema' | 'mode' | 'gratitude';
export type NoteFilter = 'all' | NoteKind;

export type DiaryEntry = {
  type: NoteKind;
  date: string;
  schemaIds?: string[];
  modeId?: string;
  excerpt: string;
};

export type SchemaNoteData = {
  schemaId: string;
  triggers: string; feelings: string; thoughts: string;
  origins: string; reality: string; healthyView: string; behavior: string;
};

export type ModeNoteData = {
  modeId: string;
  triggers: string; feelings: string; thoughts: string;
  needs: string; behavior: string; origins: string; healthyView: string;
  modeFunction: string; needsMet: string;
};

export interface NoteField { label: string; val: string }

export interface NoteItem {
  key: string;
  kind: NoteKind;
  typeLabel: string;
  title: string;
  date: string | null;
  excerpt: string;
  fields: NoteField[];
}

export const FILTERS: { id: NoteFilter; label: string }[] = [
  { id: 'all', label: 'Все' },
  { id: 'schema', label: 'Схемы' },
  { id: 'mode', label: 'Режимы' },
  { id: 'gratitude', label: 'Благодарность' },
];

const nonEmpty = (fields: { label: string; val?: string }[]): NoteField[] =>
  fields.filter((f): f is NoteField => !!f.val?.trim());

const schemaName = (id: string) => SCHEMA_DOMAINS.flatMap(d => d.schemas).find(s => s.id === id)?.name;

function diaryTitle(e: DiaryEntry): { title: string; typeLabel: string } {
  if (e.type === 'schema') {
    const ids = e.schemaIds ?? [];
    let title = ids[0] ? (schemaName(ids[0]) ?? ids.join(', ')) : 'Схема';
    if (ids.length > 1) title += ` +${ids.length - 1}`;
    return { title, typeLabel: 'Схема-дневник' };
  }
  if (e.type === 'mode') {
    return { title: getModeById(e.modeId ?? '')?.name ?? e.modeId ?? 'Режим', typeLabel: 'Режим-дневник' };
  }
  return { title: 'Благодарность', typeLabel: 'Дневник благодарности' };
}

/** Единый список записей: события дневника, затем схема-карточки, затем режим-карточки. */
export function buildNoteItems(diary: DiaryEntry[], schemaNotes: SchemaNoteData[], modeNotes: ModeNoteData[]): NoteItem[] {
  const items: NoteItem[] = diary.map((e, i) => ({
    key: `d${i}`, kind: e.type, ...diaryTitle(e), date: e.date, excerpt: e.excerpt, fields: [],
  }));
  for (const n of schemaNotes) {
    items.push({
      key: `s${n.schemaId}`, kind: 'schema', typeLabel: 'Схема-карточка', title: schemaName(n.schemaId) ?? n.schemaId,
      date: null, excerpt: '',
      fields: nonEmpty([
        { label: 'Триггеры', val: n.triggers }, { label: 'Чувства', val: n.feelings }, { label: 'Мысли', val: n.thoughts },
        { label: 'Корни', val: n.origins }, { label: 'Проверка реальности', val: n.reality },
        { label: 'Здоровый взгляд', val: n.healthyView }, { label: 'Поведение', val: n.behavior },
      ]),
    });
  }
  for (const n of modeNotes) {
    items.push({
      key: `m${n.modeId}`, kind: 'mode', typeLabel: 'Режим-карточка', title: getModeById(n.modeId)?.name ?? n.modeId,
      date: null, excerpt: '',
      fields: nonEmpty([
        { label: 'Триггеры', val: n.triggers }, { label: 'Чувства', val: n.feelings }, { label: 'Мысли', val: n.thoughts },
        { label: 'Поведение', val: n.behavior }, { label: 'Функция режима', val: n.modeFunction },
        { label: 'Потребности', val: n.needs }, { label: 'Даёт ли то, что нужно', val: n.needsMet },
        { label: 'Корни', val: n.origins }, { label: 'Здоровый взгляд', val: n.healthyView },
      ]),
    });
  }
  return items;
}

export function filterNotes(items: NoteItem[], filter: NoteFilter): NoteItem[] {
  return filter === 'all' ? items : items.filter(i => i.kind === filter);
}

export function countByFilter(items: NoteItem[]): Record<NoteFilter, number> {
  return {
    all: items.length,
    schema: items.filter(i => i.kind === 'schema').length,
    mode: items.filter(i => i.kind === 'mode').length,
    gratitude: items.filter(i => i.kind === 'gratitude').length,
  };
}
