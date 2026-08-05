// «Тёплые слова» — коллекция слов поддержки, которые пользователь сам себе
// написал (ответы Здорового Взрослого). Источники: карточка режима
// (UserModeNote.healthyView), запись дневника режимов
// (ModeDiaryEntry.healthyResponse) и переписанная фраза из разбора
// (UserPhraseCheck.rewrite) — последняя попадает сюда ТОЛЬКО по явному выбору
// пользователя (флаг inWarmWords), а не автоматически. Чистая функция-сборщик,
// общая для webapp/miniapp (правило №3).
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

export interface WarmWordsPhraseCheckSource {
  id: number;
  rewrite?: string | null;
  inWarmWords?: boolean | null;
  createdAt: string;
}

export interface WarmWordsItem {
  key: string;
  source: 'diary' | 'card' | 'phrase';
  /** Пусто у слов из разбора фразы — режима там нет. */
  modeId: string;
  text: string;
  at: Date;
}

/** Собирает и сортирует «тёплые слова» из всех трёх источников. */
export function collectWarmWords(
  modeNotes: WarmWordsModeNoteSource[],
  modeEntries: WarmWordsModeEntrySource[],
  phraseChecks: WarmWordsPhraseCheckSource[] = [],
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

  const fromPhrases: WarmWordsItem[] = phraseChecks
    .filter((p) => p.inWarmWords && (p.rewrite ?? '').trim().length > 0)
    .map((p) => ({
      key: `phrase-${p.id}`,
      source: 'phrase' as const,
      modeId: '',
      text: p.rewrite!.trim(),
      at: new Date(p.createdAt),
    }));

  return [...fromCards, ...fromDiary, ...fromPhrases].sort(
    (a, b) => b.at.getTime() - a.at.getTime(),
  );
}
