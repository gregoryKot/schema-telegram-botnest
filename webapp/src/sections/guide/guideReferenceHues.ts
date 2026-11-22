// Сверка правила «на одной вкладке справочника листы не в одном цвете и не без знака»: что видит глаз на
// вкладке — оттенок и знак каждого листа (свой у строки или листа группы) — и чего на ней не хватает.
import type { PaperHue } from '../../../../shared/src/theme/entityLook';
import type { SignKey } from '../../../../shared/src/theme/signKeys';
import type { ReferenceGroup } from './guideReferenceModel';

export interface SheetView { id: string; hue: PaperHue; sign?: SignKey }

/** Листы вкладки, как они нарисованы: оттенок и знак строки, а без своих — листа группы (подгруппы). */
export const tabSheets = (groups: ReferenceGroup[]): SheetView[] =>
  groups.flatMap((g) => (g.parts ?? [g]).flatMap((p) =>
    p.items.map((i) => ({ id: i.id, hue: i.hue ?? p.look.hue, sign: i.sign ?? p.look.sign }))));

/** Сколько разных оттенков вкладке нужно: по числу смысловых групп, но не меньше трёх (на короткой вкладке — по числу листов). */
export const huesNeeded = (sheets: number, semanticGroups: number): number =>
  Math.min(sheets, Math.max(3, semanticGroups));

/** Нарушения правила на вкладке: пустой список — вкладка в порядке. */
export function tabLookProblems(groups: ReferenceGroup[], semanticGroups: number): string[] {
  const sheets = tabSheets(groups);
  const hues = new Set(sheets.map((s) => s.hue)).size;
  const need = huesNeeded(sheets.length, semanticGroups);
  return [
    ...(hues < need ? [`оттенков ${hues}, нужно не меньше ${need}`] : []),
    ...sheets.filter((s) => !s.sign).map((s) => `лист без знака: ${s.id}`),
  ];
}
