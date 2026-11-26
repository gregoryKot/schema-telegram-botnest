// Листы «Справочника» в общем поиске: по запросу — движок самого справочника (rankReference); он
// отбрасывает родовые слова («режим», «схема») и не прощает опечаток — тогда лист ищется по названию и синонимам.
import { rowScoreWithAliases } from '../../../../shared/src/search/aliasScore';
import { ROW_SCORE } from '../../../../shared/src/search/rankRows';
import { searchAliases } from '../../../../shared/src/schemaTherapy/searchAliases';
import type { ReferenceItem } from '../../sections/guide/guideReferenceModel';
import { rankReference, referenceLeaves } from '../../sections/guide/guideReferenceSearch';
import { THERAPIST_NAV } from '../appShell/navLook';
import type { CmdRow } from '../CommandPaletteList';
import type { PaletteInput } from './paletteRows';

export const GUIDE_GROUP = 'Справочник';
/** Сколько листов справочника видно по запросу. */
export const GUIDE_SHOWN = 6;

interface Leaf { item: ReferenceItem; section: string; title: string; snippet?: string }

/** Подзаголовок — кусок совпавшего текста или «Раздел · Группа». */
function guideRow({ item, snippet, section, title }: Leaf, run: PaletteInput['run']): CmdRow {
  return {
    key: `guide:${item.kind}:${item.id}`, kind: 'guide', group: GUIDE_GROUP, label: item.name,
    sub: snippet ?? (title === section ? section : `${section} · ${title}`),
    mark: { sign: item.sign ?? THERAPIST_NAV.guide.sign }, search: item.name,
    action: () => run.guideSheet({ kind: item.kind, id: item.id }),
  };
}

/** Вес листа по названию и его поисковым синонимам (другие переводы названий схем и режимов). */
const leafScore = (item: ReferenceItem, query: string) => rowScoreWithAliases(item.name, '', query, searchAliases(item.kind, item.id));

/** Все листы справочника — среди них «Недавнее» находит лист по ключу. */
export function allGuideRows({ guide, run }: PaletteInput): CmdRow[] {
  return guide ? referenceLeaves(guide.ref).map((leaf) => guideRow(leaf, run)) : [];
}

/** Лучшие листы по запросу; движок ничего не нашёл — листы, чьё название подходит запросу, по весу. */
export function guideRows({ guide, query, run }: PaletteInput): { row: CmdRow; score: number }[] {
  if (!guide) return [];
  const hits = rankReference(guide.ref, query, guide.body);
  if (hits.length > 0) {
    // Название не совпало (нашлось в тексте листа) — наименьший вес, порядок справочника сохраняется.
    return hits.slice(0, GUIDE_SHOWN)
      .map((hit) => ({ row: guideRow(hit, run), score: Math.max(leafScore(hit.item, query), ROW_SCORE.text) }));
  }
  return referenceLeaves(guide.ref)
    .map((leaf) => ({ row: guideRow(leaf, run), score: leafScore(leaf.item, query) }))
    .filter((r) => r.score > ROW_SCORE.none)
    .sort((a, b) => b.score - a.score)
    .slice(0, GUIDE_SHOWN);
}
