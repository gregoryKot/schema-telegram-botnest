// «Справочник» терапевта (#995, шаг 4): четыре раздела — режимы по группам,
// схемы по доменам, техники и «Для терапевта» — и поиск по названиям сразу во
// всех разделах. Чистая модель: тексты справочника (отдельный чанк,
// guideLoader) плюс названия групп и доменов из реестров
// shared/src/schemaTherapy/content/. Порядок групп и строк — как в реестрах;
// режим или схема без своего раздела в справочнике в список не попадает,
// пустая группа не показывается. Вид группы — лист бумаги её оттенка со знаком
// у подписи (guideLook.ts: группа режимов, домен схем — те же таблицы, что у
// клиента); у техник и «Для терапевта» знак свой у каждой строки, у листа — нет.
import type { Guide } from '../../../../shared/src/therapy/conceptGraph/guideLoader';
import type { Tr } from '../../../../shared/src/needs/types';
import type { TechniqueId } from '../../../../shared/src/schemaTherapy/guide';
import { MODE_GROUPS } from '../../../../shared/src/schemaTherapy/content/modeGroups';
import { SCHEMA_DOMAINS } from '../../../../shared/src/schemaTherapy/content/schemaDomains';
import { domainLook, modeGroupLook, type SheetLook, type SignKey } from '../../../../shared/src/theme/entityLook';
import { modeGuideLook, practiceNoteLook, PRACTICE_HUE, schemaGuideLook, techniqueGuideLook, TECHNIQUES_HUE } from '../../components/therapist/guide/guideLook';
import { mergeCoping } from './guideReferenceCoping';

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
  /** Строка под названием: у техники и раздела «Для терапевта» — суть. */
  sub?: string;
  /** Знак листа (ключ реестра SignArt); нет — строка без картинки (не выдумываем чужую). */
  sign?: SignKey;
} & ({ kind: 'mode' | 'schema' | 'note'; id: string } | { kind: 'technique'; id: TechniqueId });

export interface ReferenceGroup {
  key: string;
  /** Подпись группы; у техник и «Для терапевта» её нет — список один. */
  title?: string;
  /** Бумага листа группы и её знак (группа режимов, домен схем): знак стоит у подписи один раз,
   *  строки группы его не повторяют. Без знака (техники, «Для терапевта») — знак у каждой строки свой. */
  look: SheetLook;
  items: ReferenceItem[];
  /** Подгруппы одного листа (три копинга на листе неба): подпись и знак у каждой, `items` — все строки подряд. */
  parts?: (Required<Pick<ReferenceGroup, 'key' | 'title' | 'look'>> & Pick<ReferenceGroup, 'items'>)[];
}

export type Reference = Record<ReferenceTab, ReferenceGroup[]>;

/** Вид списка (GuideReferenceList): листы групп в две колонки, карточки со знаком у строки, листы поиска в столбик. */
export type ReferenceLayout = 'groups' | 'tiles' | 'rows';

/** Режимы и схемы — группами, техники и «Для терапевта» — карточками, поиск — листами в столбик. */
export function referenceLayout(tab: ReferenceTab, searching: boolean): ReferenceLayout {
  if (searching) return 'rows';
  return tab === 'modes' || tab === 'schemas' ? 'groups' : 'tiles';
}

export type ReferenceTexts = Pick<
  Guide,
  'buildModeGuides' | 'buildSchemaDomainGuides' | 'buildTechniqueGuides' | 'practiceNotes'
>;

const nonEmpty = (groups: ReferenceGroup[]) => groups.filter((g) => g.items.length > 0);
/** Лист без подписи и знака: домен, которого нет в таблице вида, не красится чужим оттенком. */
const PLAIN_HUE = TECHNIQUES_HUE;

/** Списки четырёх разделов в форме обращения `tr`. */
export function buildReference(texts: ReferenceTexts, tr: Tr): Reference {
  const modeIds = new Set(texts.buildModeGuides(tr).map((g) => g.modeId));
  const schemaIds = new Set(
    texts.buildSchemaDomainGuides(tr).flatMap((d) => d.schemas.map((s) => s.schemaId)),
  );
  return {
    modes: mergeCoping(nonEmpty(MODE_GROUPS.map((g) => ({
      key: g.id,
      title: g.group,
      look: modeGroupLook(g.id),
      items: g.items
        .filter((m) => modeIds.has(m.id))
        .map((m) => ({ kind: 'mode' as const, id: m.id, name: m.name, sign: modeGuideLook(m.id).sign })),
    })))),
    schemas: nonEmpty(SCHEMA_DOMAINS.map((d) => ({
      key: d.id,
      title: d.domain,
      look: domainLook(d.id) ?? { hue: PLAIN_HUE },
      items: d.schemas
        .filter((s) => schemaIds.has(s.id))
        .map((s) => ({ kind: 'schema' as const, id: s.id, name: s.name, sign: schemaGuideLook(s.id)?.sign })),
    }))),
    techniques: nonEmpty([{
      key: 'techniques',
      look: { hue: TECHNIQUES_HUE },
      items: texts.buildTechniqueGuides(tr).map((t) => ({
        kind: 'technique' as const, id: t.id, name: t.name, sub: t.summary, sign: techniqueGuideLook(t.id).sign,
      })),
    }]),
    practice: nonEmpty([{
      key: 'practice',
      look: { hue: PRACTICE_HUE },
      items: texts.practiceNotes(tr).map((n) => ({
        kind: 'note' as const, id: n.id, name: n.title, sub: n.summary, sign: practiceNoteLook(n.id).sign,
      })),
    }]),
  };
}
