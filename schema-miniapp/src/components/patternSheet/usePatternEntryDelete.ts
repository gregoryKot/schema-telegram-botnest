import type { Dispatch, SetStateAction } from 'react';
import { api } from '../../api';
import type { MyCardsKind } from '../myCards/useMyCards';
import type { SchemaDiaryEntry, ModeDiaryEntry } from '../../types';

// Удаление записи дневника из PatternSheet — вынесено (правило №10, файл
// был у потолка). Оптимистично убирает запись, при провале API возвращает
// обратно: иначе запись молча пропадала из UI навсегда, хотя осталась на
// сервере (revert для optimistic update).
export function usePatternEntryDelete({
  kind,
  schemaEntries,
  setSchemaEntries,
  modeEntries,
  setModeEntries,
}: {
  kind: MyCardsKind;
  schemaEntries: SchemaDiaryEntry[];
  setSchemaEntries?: Dispatch<SetStateAction<SchemaDiaryEntry[]>>;
  modeEntries: ModeDiaryEntry[];
  setModeEntries?: Dispatch<SetStateAction<ModeDiaryEntry[]>>;
}) {
  return function deleteEntry(entryId: number) {
    if (kind === 'schema') {
      const removed = schemaEntries.find((e) => e.id === entryId);
      setSchemaEntries?.((prev) => prev.filter((e) => e.id !== entryId));
      api.deleteSchemaDiary(entryId).catch((e) => {
        console.error('deleteSchemaDiary failed', e);
        if (removed) setSchemaEntries?.((prev) => [removed, ...prev]);
      });
    } else {
      const removed = modeEntries.find((e) => e.id === entryId);
      setModeEntries?.((prev) => prev.filter((e) => e.id !== entryId));
      api.deleteModeDiary(entryId).catch((e) => {
        console.error('deleteModeDiary failed', e);
        if (removed) setModeEntries?.((prev) => [removed, ...prev]);
      });
    }
  };
}
