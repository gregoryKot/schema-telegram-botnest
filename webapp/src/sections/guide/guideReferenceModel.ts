// «Справочник» терапевта (#995, шаг 4): четыре раздела — режимы по группам,
// схемы по доменам, техники и «Для терапевта» — и поиск по названиям сразу во
// всех разделах. Чистая модель: тексты справочника (отдельный чанк,
// guideLoader) плюс названия групп и доменов из реестров
// shared/src/schemaTherapy/content/. Порядок групп и строк — как в реестрах;
// режим или схема без своего раздела в справочнике в список не попадает,
// пустая группа не показывается.
import type { Guide } from '../../../../shared/src/therapy/conceptGraph/guideLoader';
import type { Tr } from '../../../../shared/src/needs/types';
import type { TechniqueId } from '../../../../shared/src/schemaTherapy/guide';
import { MODE_GROUPS } from '../../../../shared/src/schemaTherapy/content/modeGroups';
import { SCHEMA_DOMAINS } from '../../../../shared/src/schemaTherapy/content/schemaDomains';
import { matchesSearch } from '../../../../shared/src/utils/searchNormalize';

export type ReferenceTab = 'modes' | 'schemas' | 'techniques' | 'practice';


export const REFERENCE_TABS: { id: ReferenceTab; label: string }[] = [
  { id: 'modes', label: 'Режимы' },
  { id: 'schemas', label: 'Схемы' },
  { id: 'techniques', label: 'Техники' },
  { id: 'practice', label: 'Для терапевта' },
];

/** Строка списка: открывает лист режима, схемы, техники или раздела «Для терапевта». */
export type ReferenceItem = {
  name: string;
  /** Строка под названием: у техники — что это и зачем. */
  sub?: string;
} & ({ kind: 'mode' | 'schema' | 'note'; id: string } | { kind: 'technique'; id: TechniqueId });

export interface ReferenceGroup {
  key: string;
  /** Подпись группы; у техник и «Для терапевта» её нет — список один. */
  title?: string;
  items: ReferenceItem[];
}

export type Reference = Record<ReferenceTab, ReferenceGroup[]>;

export type ReferenceTexts = Pick<
  Guide,
  'buildModeGuides' | 'buildSchemaDomainGuides' | 'buildTechniqueGuides' | 'practiceNotes'
>;

const nonEmpty = (groups: ReferenceGroup[]) => groups.filter((g) => g.items.length > 0);

/** Списки четырёх разделов в форме обращения `tr`. */
export function buildReference(texts: ReferenceTexts, tr: Tr): Reference {
  const modeIds = new Set(texts.buildModeGuides(tr).map((g) => g.modeId));
  const schemaIds = new Set(
    texts.buildSchemaDomainGuides(tr).flatMap((d) => d.schemas.map((s) => s.schemaId)),
  );
  return {
    modes: nonEmpty(MODE_GROUPS.map((g) => ({
      key: g.id,
      title: g.group,
      items: g.items
        .filter((m) => modeIds.has(m.id))
        .map((m) => ({ kind: 'mode' as const, id: m.id, name: m.name })),
    }))),
    schemas: nonEmpty(SCHEMA_DOMAINS.map((d) => ({
      key: d.id,
      title: d.domain,
      items: d.schemas
        .filter((s) => schemaIds.has(s.id))
        .map((s) => ({ kind: 'schema' as const, id: s.id, name: s.name })),
    }))),
    techniques: nonEmpty([{
      key: 'techniques',
      items: texts.buildTechniqueGuides(tr).map((t) => ({
        kind: 'technique' as const, id: t.id, name: t.name, sub: t.summary,
      })),
    }]),
    practice: nonEmpty([{
      key: 'practice',
      items: texts.practiceNotes(tr).map((n) => ({ kind: 'note' as const, id: n.id, name: n.title })),
    }]),
  };
}

/**
 * Поиск по названиям во всех разделах: одна группа на раздел с совпадениями,
 * подпись — имя раздела. Регистр и «ё/е» не различаются (matchesSearch).
 * Пустой запрос — пустой список: экран тогда показывает выбранный раздел.
 */
export function searchReference(ref: Reference, query: string): ReferenceGroup[] {
  if (!query.trim()) return [];
  return nonEmpty(REFERENCE_TABS.map((tab) => ({
    key: tab.id,
    title: tab.label,
    items: ref[tab.id].flatMap((g) => g.items).filter((i) => matchesSearch(i.name, query)),
  })));
}
