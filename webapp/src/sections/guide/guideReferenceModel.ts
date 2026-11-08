// «Справочник» терапевта (#995, шаг 4): четыре раздела — режимы по группам,
// схемы по доменам, техники и «Для терапевта» — и поиск по названиям сразу во
// всех разделах. Чистая модель: тексты справочника (отдельный чанк,
// guideLoader) плюс названия групп и доменов из реестров
// shared/src/schemaTherapy/content/. Порядок групп и строк — как в реестрах;
// режим или схема без своего раздела в справочнике в список не попадает,
// пустая группа не показывается. Знаки — тем же языком, что герой листа
// (guideSignsModel): у группы режимов — знак группы, у домена — DomainArt, у
// строки — знак её листа (в поиске строки разных групп идут вперемешку).
import type { Guide } from '../../../../shared/src/therapy/conceptGraph/guideLoader';
import type { Tr } from '../../../../shared/src/needs/types';
import type { TechniqueId } from '../../../../shared/src/schemaTherapy/guide';
import { MODE_GROUPS } from '../../../../shared/src/schemaTherapy/content/modeGroups';
import { SCHEMA_DOMAINS } from '../../../../shared/src/schemaTherapy/content/schemaDomains';
import { matchesSearch } from '../../../../shared/src/utils/searchNormalize';
import {
  modeGroupSign, modeSign, practiceNoteSign, TECHNIQUE_SIGN, type GuideSign,
} from '../../components/art/guideSignsModel';

export type ReferenceTab = 'modes' | 'schemas' | 'techniques' | 'practice';


export const REFERENCE_TABS: { id: ReferenceTab; label: string }[] = [
  { id: 'modes', label: 'Режимы' },
  { id: 'schemas', label: 'Схемы' },
  { id: 'techniques', label: 'Техники' },
  { id: 'practice', label: 'Для терапевта' },
];

/** Знак строки или группы: знак листа подсказок (GuideSignArt) или домен схем 1–5 (DomainArt). */
export type ReferenceArt = { sign: GuideSign } | { domain: number };

/** Строка списка: открывает лист режима, схемы, техники или раздела «Для терапевта». */
export type ReferenceItem = {
  name: string;
  /** Строка под названием: у техники и раздела «Для терапевта» — суть. */
  sub?: string;
  /** Знак листа; нет — строка без картинки (не выдумываем чужую). */
  art?: ReferenceArt;
} & ({ kind: 'mode' | 'schema' | 'note'; id: string } | { kind: 'technique'; id: TechniqueId });

export interface ReferenceGroup {
  key: string;
  /** Подпись группы; у техник и «Для терапевта» её нет — список один. */
  title?: string;
  /** Знак группы (группа режимов, домен схем): стоит у подписи, строки группы его не повторяют. */
  art?: ReferenceArt;
  items: ReferenceItem[];
}

export type Reference = Record<ReferenceTab, ReferenceGroup[]>;

/** Вид списка (GuideReferenceList): группы со знаком у подписи, карточки со знаком у строки, строки поиска. */
export type ReferenceLayout = 'groups' | 'tiles' | 'rows';

/** Режимы и схемы — группами, техники и «Для терапевта» — карточками, поиск — строками вперемешку. */
export function referenceLayout(tab: ReferenceTab, searching: boolean): ReferenceLayout {
  if (searching) return 'rows';
  return tab === 'modes' || tab === 'schemas' ? 'groups' : 'tiles';
}

export type ReferenceTexts = Pick<
  Guide,
  'buildModeGuides' | 'buildSchemaDomainGuides' | 'buildTechniqueGuides' | 'practiceNotes'
>;

const nonEmpty = (groups: ReferenceGroup[]) => groups.filter((g) => g.items.length > 0);
const signArt = (sign: GuideSign | null): ReferenceArt | undefined => (sign ? { sign } : undefined);

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
      art: { sign: modeGroupSign(g.id) },
      items: g.items
        .filter((m) => modeIds.has(m.id))
        .map((m) => ({ kind: 'mode' as const, id: m.id, name: m.name, art: { sign: modeSign(m.id) } })),
    }))),
    schemas: nonEmpty(SCHEMA_DOMAINS.map((d, i) => ({
      key: d.id,
      title: d.domain,
      art: { domain: i + 1 },
      items: d.schemas
        .filter((s) => schemaIds.has(s.id))
        .map((s) => ({ kind: 'schema' as const, id: s.id, name: s.name, art: { domain: i + 1 } })),
    }))),
    techniques: nonEmpty([{
      key: 'techniques',
      items: texts.buildTechniqueGuides(tr).map((t) => ({
        kind: 'technique' as const, id: t.id, name: t.name, sub: t.summary, art: { sign: TECHNIQUE_SIGN[t.id] },
      })),
    }]),
    practice: nonEmpty([{
      key: 'practice',
      items: texts.practiceNotes(tr).map((n) => ({
        kind: 'note' as const, id: n.id, name: n.title, sub: n.summary, art: signArt(practiceNoteSign(n.id)),
      })),
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
