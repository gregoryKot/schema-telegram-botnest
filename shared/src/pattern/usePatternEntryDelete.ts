import type { Dispatch, SetStateAction } from 'react';
import type { MyCardsKind } from './useMyCards';
import type { SchemaDiaryEntry, ModeDiaryEntry } from '../types';
import { deleteDiaryEntry, type DiaryDeleteApi } from '../diary/diaryDelete';

/** Срез api площадки: удаление записей дневника (тот же, что у «Записей»). */
export type PatternDiaryDeleteApi = DiaryDeleteApi;

// Удаление записи дневника из PatternSheet — та же механика, что в «Записях»
// (правило №3, shared/src/diary/diaryDelete.ts). Раньше удаление было
// оптимистичным: запись пропадала, на отказе молча возвращалась, текст сбоя
// в консоль — человек видел «удалил, а она снова тут» без единого слова, и
// 404 (записи уже нет) тоже считался сбоем. Теперь запись уходит из списка
// только после ответа сервера; отказ пробрасывается — кнопка «Удалить
// навсегда» (DeleteBtn → useDeleteAction) показывает deleteFailedNote, запись
// остаётся на месте.
export function usePatternEntryDelete({
  api,
  kind,
  setSchemaEntries,
  setModeEntries,
}: {
  api: PatternDiaryDeleteApi;
  kind: MyCardsKind;
  setSchemaEntries?: Dispatch<SetStateAction<SchemaDiaryEntry[]>>;
  setModeEntries?: Dispatch<SetStateAction<ModeDiaryEntry[]>>;
}) {
  return async function deleteEntry(entryId: number): Promise<void> {
    await deleteDiaryEntry(api, kind, entryId);
    if (kind === 'schema')
      setSchemaEntries?.((prev) => prev.filter((e) => e.id !== entryId));
    else setModeEntries?.((prev) => prev.filter((e) => e.id !== entryId));
  };
}
