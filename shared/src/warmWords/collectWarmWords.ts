// «Тёплые слова» — коллекция слов поддержки, которые пользователь сам себе
// написал (ответы Здорового Взрослого). Источники: карточка режима
// (UserModeNote.healthyView) и запись дневника режимов
// (ModeDiaryEntry.healthyResponse). Чистая функция-сборщик, общая для
// webapp/miniapp (правило №3) — читает оба источника и отдаёт единый
// отсортированный список.
//
// Структурные типы, а не импорт из api-клиента: этот модуль не должен
// зависеть от конкретного фронтенда.
export interface WarmWordsModeNoteSource {
  modeId: string;
  healthyView?: string | null;
  updatedAt: string;
}

export interface WarmWordsModeEntrySource {
  id: number;
  modeId: string;
  healthyResponse?: string | null;
  createdAt: string;
}

export interface WarmWordsItem {
  key: string;
  source: 'diary' | 'card';
  modeId: string;
  text: string;
  at: Date;
}

/** Собирает и сортирует «тёплые слова» из карточек режимов и дневника режимов. */
export function collectWarmWords(
  modeNotes: WarmWordsModeNoteSource[],
  modeEntries: WarmWordsModeEntrySource[],
): WarmWordsItem[] {
  const fromCards: WarmWordsItem[] = modeNotes
    .filter((n) => (n.healthyView ?? '').trim().length > 0)
    .map((n) => ({
      key: `card-${n.modeId}`,
      source: 'card' as const,
      modeId: n.modeId,
      text: n.healthyView!.trim(),
      at: new Date(n.updatedAt),
    }));

  const fromDiary: WarmWordsItem[] = modeEntries
    .filter((e) => (e.healthyResponse ?? '').trim().length > 0)
    .map((e) => ({
      key: `diary-${e.id}`,
      source: 'diary' as const,
      modeId: e.modeId,
      text: e.healthyResponse!.trim(),
      at: new Date(e.createdAt),
    }));

  return [...fromCards, ...fromDiary].sort(
    (a, b) => b.at.getTime() - a.at.getTime(),
  );
}
