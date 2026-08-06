// Статус строки в списке «Мои схемы»/«Мои режимы» — заполнена ли карточка
// и сколько записей дневника набралось (правило CLAUDE.md: статус словами,
// не только цветом — иначе не читается при цветовой слепоте). Плюрализация —
// готовый хелпер pluralEntries, а не своя копия (правило переиспользования).
import { pluralEntries } from '../../../../shared/src/share/shareTexts';
import type { SchemaDiaryEntry, ModeDiaryEntry } from '../../types';

export function patternStatusText(filled: boolean, entryCount: number): string {
  if (!filled) return 'карточка пока пустая';
  if (entryCount === 0) return 'карточка заполнена';
  return `карточка заполнена · ${entryCount} ${pluralEntries(entryCount)}`;
}

/** Сколько записей дневника схем упоминают каждую схему — одна запись может
 * относиться сразу к нескольким схемам (schemaIds), считаем её в каждую. */
export function schemaEntryCounts(
  entries: SchemaDiaryEntry[],
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const e of entries)
    for (const id of e.schemaIds) counts[id] = (counts[id] ?? 0) + 1;
  return counts;
}

export function modeEntryCounts(
  entries: ModeDiaryEntry[],
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const e of entries) counts[e.modeId] = (counts[e.modeId] ?? 0) + 1;
  return counts;
}
