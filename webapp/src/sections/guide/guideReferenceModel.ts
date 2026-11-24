// «Справочник» терапевта (#995, шаг 4): разделы из REFERENCE_TABS и поиск по названиям и текстам листов сразу во всех
// (guideReferenceSearch.ts). Чистая модель: тексты справочника (отдельный чанк, guideLoader) плюс названия групп и доменов
// из реестров shared/src/schemaTherapy/content/. Режим или схема без своего раздела в список не попадает, пустая группа не
// показывается. Группа режимов и домен схем — лист бумаги своего оттенка со знаком у подписи (guideLook.ts); у остальных
// разделов знак свой у каждой строки.
import type { Guide } from '../../../../shared/src/therapy/conceptGraph/guideLoader';
import type { NeedId, Tr } from '../../../../shared/src/needs/types';
import type { TechniqueId } from '../../../../shared/src/schemaTherapy/guide';
import { MODE_GROUPS } from '../../../../shared/src/schemaTherapy/content/modeGroups';
import { SCHEMA_DOMAINS } from '../../../../shared/src/schemaTherapy/content/schemaDomains';
import { domainLook, modeGroupLook, type PaperHue, type SheetLook, type SignKey } from '../../../../shared/src/theme/entityLook';
import { modeGuideLook, schemaGuideLook, TECHNIQUES_HUE } from '../../components/therapist/guide/guideLook';
import { mergeCoping } from './guideReferenceCoping';
import { practiceGroups, techniqueGroups } from './guideReferenceTechniques';
import { buildNeedGuides, needGroups } from './guideReferenceNeeds';
import { concernGroups } from './guideReferenceConcerns';
import { phaseGroups } from './guideReferencePhases';

export type ReferenceTab = 'modes' | 'schemas' | 'needs' | 'techniques' | 'concerns' | 'path' | 'practice';

export const REFERENCE_TABS: { id: ReferenceTab; label: string }[] = [
  { id: 'modes', label: 'Режимы' },
  { id: 'schemas', label: 'Схемы' },
  { id: 'needs', label: 'Потребности' },
  { id: 'techniques', label: 'Техники' },
  { id: 'concerns', label: 'Запросы' },
  { id: 'path', label: 'Путь терапии' },
  { id: 'practice', label: 'Для терапевта' },
];

/** Строка списка: открывает лист своего вида (режим, схема, потребность, техника, запрос, фаза, «Для терапевта»). */
export type ReferenceItem = {
  name: string;
  /** Строка под названием: у потребности, техники и раздела «Для терапевта» — суть. */
  sub?: string;
  /** Знак листа (ключ реестра SignArt); нет — строка без картинки (не выдумываем чужую). */
  sign?: SignKey;
  step?: number; // номер фазы в ленте «Пути терапии»: над знаком (у строки с оттенком) или на его месте
  /** Оттенок самого листа: строка рисуется бумажной карточкой этого оттенка (лист «Пути терапии»). */
  hue?: PaperHue;
} & ({ kind: 'mode' | 'schema' | 'note' | 'concern' | 'phase'; id: string } | { kind: 'technique'; id: TechniqueId } | { kind: 'need'; id: NeedId });

export interface ReferenceGroup {
  key: string;
  /** Подпись группы; у потребностей её нет — список один. */
  title?: string;
  /** Под подписью — простыми словами (группы «Техник»: «через понимание»). */
  hint?: string;
  /** Группа сворачивается тапом по шапке (группы «Техник» и «Для терапевта»); по умолчанию раскрыта. */
  fold?: boolean;
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

/** Режимы и схемы — группами, остальные разделы — карточками, поиск — листами в столбик. */
export const referenceLayout = (tab: ReferenceTab, searching: boolean): ReferenceLayout =>
  searching ? 'rows' : tab === 'modes' || tab === 'schemas' ? 'groups' : 'tiles';

export type ReferenceTexts = Pick<
  Guide,
  'buildModeGuides' | 'buildSchemaDomainGuides' | 'buildTechniqueGuides' | 'practiceNotes' | 'buildConcernGuides' | 'buildPhaseGuides'
> & Partial<Pick<Guide, 'needGuides'>>;

const nonEmpty = (groups: ReferenceGroup[]) => groups.filter((g) => g.items.length > 0);
/** Лист без подписи и знака: домен, которого нет в таблице вида, не красится чужим оттенком. */
const PLAIN_HUE = TECHNIQUES_HUE;

/** Списки разделов в форме обращения `tr`. */
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
    needs: nonEmpty(needGroups(buildNeedGuides(texts, tr))),
    techniques: nonEmpty(techniqueGroups(texts.buildTechniqueGuides(tr))),
    concerns: nonEmpty(concernGroups(texts.buildConcernGuides(tr))),
    path: nonEmpty(phaseGroups(texts.buildPhaseGuides(tr))),
    practice: nonEmpty(practiceGroups(texts.practiceNotes(tr))),
  };
}
