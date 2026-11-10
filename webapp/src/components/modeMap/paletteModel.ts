// Данные палитры холста (ModeMapPalette): блок клиента, фигуры, каталог и поиск.
// Чистые функции без JSX: какой знак у строки и какого он цвета, решается здесь,
// рисуют PaletteMark (строки) и PaletteCatalog (знаки групп). Цвет строки — цвет
// фигуры на холсте: режим — цвет типа узла (TYPE_COLORS), схема — цвет домена.
import type { TherapistCustomMode } from '../../api';
import { getModeById, MODE_GROUPS, SCHEMA_DOMAINS, type ModeGroup, type SchemaDomain } from '../../schemaTherapyData';
import { COPING_KIND_LABEL } from '../../../../shared/src/therapy/conceptGraph/modeLanes';
import { NEEDS_TITLE } from '../../../../shared/src/therapy/conceptGraph/diagram/diagramCircle';
import { GROUP_TO_TYPE, TYPE_COLORS, type NodeType } from '../modeMapData';
import { findModeMeta } from './modeNodeMeta';
import { makeModeNode, type Draft } from './modeDraft';
import { nodeTexts } from './nodeTexts';
import { schemaDraft, schemaNode } from './schemaDraft';
import { matchCustomModes, matchDomainSchemas, matchGroupItems, matchesWords } from './paletteSearch';

/** Знак строки: режим — круг, схема — два слоя, у фигур — свой знак (PaletteMark). */
export type MarkKind = 'mode' | 'schema' | 'trigger' | 'behavior' | 'origin' | 'need' | 'needs';

export interface PaletteItem { id: string; name: string; hint?: string; mark: MarkKind; color: string; draft: () => Draft }

/** Группа каталога: группа режимов (знак группы) или домен схем (domain — номер для DomainArt). */
export interface CatalogGroup { id: string; title: string; hint: string; total: number; items: PaletteItem[]; domain?: number }

// Клинический порядок: детские → критики → копинги → здоровые.
const GROUP_ORDER = ['child', 'critic', 'coping_overcompensation', 'coping_avoidance', 'coping_surrender', 'healthy'];

/** Короткие подписи групп: «Копинг: Гиперкомпенсация» не входит в строку палитры; полное имя — в подсказке. */
export const GROUP_LABEL: Record<string, string> = {
  child: 'Детские',
  critic: 'Критикующие',
  coping_overcompensation: COPING_KIND_LABEL.overcompensation,
  coping_avoidance: COPING_KIND_LABEL.avoidance,
  coping_surrender: COPING_KIND_LABEL.surrender,
  healthy: 'Здоровые',
};

const modeItem = (group: ModeGroup) => (i: ModeGroup['items'][number]): PaletteItem => {
  const meta = GROUP_TO_TYPE[group.id];
  const extra = meta.copingSubtype ? { copingSubtype: meta.copingSubtype } : {};
  return { id: i.id, name: i.name, hint: i.short, mark: 'mode', color: meta.color, draft: () => makeModeNode(i.id, meta.type, i.name, extra) };
};

const schemaItem = (d: SchemaDomain) => (s: SchemaDomain['schemas'][number]): PaletteItem =>
  ({ id: s.id, name: s.name, hint: s.desc, mark: 'schema', color: d.color, draft: () => schemaNode(s.id, s.name, d.color) });

const SORTED_GROUPS = MODE_GROUPS.filter(g => GROUP_TO_TYPE[g.id])
  .sort((a, b) => GROUP_ORDER.indexOf(a.id) - GROUP_ORDER.indexOf(b.id));

/** Шесть групп режимов каталога в клиническом порядке. */
export const CATALOG_MODE_GROUPS: CatalogGroup[] = SORTED_GROUPS.map(g => ({
  id: g.id, title: GROUP_LABEL[g.id] ?? g.group, hint: g.group, total: g.items.length, items: g.items.map(modeItem(g)),
}));

/** Пять доменов схем; номер домена — порядок SCHEMA_DOMAINS, как в DomainMark. */
export const CATALOG_DOMAINS: CatalogGroup[] = SCHEMA_DOMAINS.map((d, i) => ({
  id: `domain:${d.id}`, title: d.domain, hint: d.domain, total: d.schemas.length, items: d.schemas.map(schemaItem(d)), domain: i + 1,
}));

/** Сколько всего режимов и схем в каталоге — тихий счётчик строки «Все режимы и схемы». */
export const CATALOG_TOTAL = [...CATALOG_MODE_GROUPS, ...CATALOG_DOMAINS].reduce((n, g) => n + g.total, 0);

/** Свой режим терапевта: тот же круг, цвет — тип фигуры, выбранный при создании. */
export function customItem(m: TherapistCustomMode): PaletteItem {
  const type = m.nodeType as NodeType;
  const draft = (): Draft => ({ id: `cm_${m.id}_${Date.now()}`, type, data: { label: m.name, ...(type === 'coping' ? { copingSubtype: 'over' as const } : {}) } });
  return { id: `cm_${m.id}`, name: m.name, hint: 'Свой режим', mark: 'mode', color: TYPE_COLORS[type] ?? TYPE_COLORS.custom, draft };
}

/** Режим из концептуализации клиента; неизвестный id — null. */
export function clientModeItem(modeId: string): PaletteItem | null {
  const meta = findModeMeta(modeId);
  const lib = getModeById(modeId);
  if (!meta && !lib) return null;
  const name = meta?.name ?? lib?.name ?? modeId;
  const extra = meta?.copingSubtype ? { copingSubtype: meta.copingSubtype } : {};
  const color = meta?.color ?? lib?.groupColor ?? TYPE_COLORS.custom;
  return { id: modeId, name, hint: 'Из концептуализации клиента', mark: 'mode', color, draft: () => makeModeNode(modeId, meta?.type ?? 'custom', name, extra) };
}

/** Схема из концептуализации клиента; неизвестный id — null. */
export function clientSchemaItem(schemaId: string): PaletteItem | null {
  const d = schemaDraft(schemaId);
  if (!d) return null;
  const color = d.data.customColor ?? TYPE_COLORS.schema;
  return { id: schemaId, name: d.data.label, hint: 'Схема из концептуализации клиента', mark: 'schema', color, draft: () => schemaDraft(schemaId) ?? d };
}

type FigureType = Exclude<MarkKind, 'mode'>;
export interface Figure { type: FigureType; caption: string; hint: string; words: string; draft: () => Draft }

const conceptDraft = (type: 'schema' | 'origin' | 'need' | 'needs'): Draft => {
  const texts = nodeTexts(type);
  const label = type === 'origin' ? texts.note : type === 'needs' ? NEEDS_TITLE : texts.title;
  return { id: `${type}_${Date.now()}`, type, data: type === 'needs' ? { label, wheel: {} } : { label } }; // круг — колесо (needWheel.ts)
};
const figure = (type: FigureType, caption: string, hint: string, words: string, draft: () => Draft): Figure => ({ type, caption, hint, words, draft });

/** Фигуры холста: что не режим и не схема из каталога. Подпись короткая, полное — в подсказке. */
export const FIGURES: Figure[] = [
  figure('trigger', 'Триггер', 'Триггер / ситуация: что запускает цикл', 'триггер ситуация', () => ({ id: `trigger_${Date.now()}`, type: 'trigger', data: { label: 'Триггер' } })),
  figure('behavior', 'Поведение', 'Поведение / последствие: что человек делает и что из этого выходит', 'поведение последствие', () => ({ id: `behavior_${Date.now()}`, type: 'behavior', data: { label: 'Поведение' } })),
  figure('schema', 'Схема', 'Схема с убеждением', 'схема убеждение', () => conceptDraft('schema')),
  figure('origin', 'Опыт детства', nodeTexts('origin').note, 'опыт детства', () => conceptDraft('origin')),
  figure('need', 'Потребность', 'Одна из пяти потребностей', 'потребность', () => conceptDraft('need')),
  figure('needs', 'Круг потребностей', 'Колесо пяти потребностей: насколько каждая удовлетворялась в детстве, в 11–17 лет и сейчас', 'круг потребностей', () => conceptDraft('needs')),
];

/** Поиск по всей палитре, включая закрытый каталог: плоский список, без групп. */
export function searchPalette(q: string, custom: TherapistCustomMode[]): PaletteItem[] {
  const modes = SORTED_GROUPS.flatMap(g => matchGroupItems(g, q).map(modeItem(g)));
  const mine = matchCustomModes(custom, q).map(customItem);
  const schemas = SCHEMA_DOMAINS.flatMap(d => matchDomainSchemas(d, q).map(schemaItem(d)));
  const figures = FIGURES.filter(f => matchesWords(f.words, q))
    .map((f): PaletteItem => ({ id: `fig:${f.type}`, name: f.caption, hint: f.hint, mark: f.type, color: TYPE_COLORS[f.type], draft: f.draft }));
  return [...modes, ...mine, ...schemas, ...figures];
}
