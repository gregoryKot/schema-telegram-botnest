// Загрузка «Тёплых слов» — общая для webapp/miniapp (правило №3): оба
// источника (карточки режимов + дневник режимов) грузятся параллельно,
// собираются в единый список и трекается открытие с капом счётчика.
// DI-стиль по образцу shared/src/journey/useJourney.ts — фронтенд передаёт
// свои api-функции параметрами, хук не знает про конкретный api-клиент.
import { useEffect, useState } from 'react';
import { collectWarmWords, type WarmWordsItem } from './collectWarmWords';
import type {
  WarmWordsModeEntrySource,
  WarmWordsModeNoteSource,
} from './collectWarmWords';
import { WARM_WORDS_OPEN_EVENT } from '../share/analytics';

export interface WarmWordsDeps {
  getModeNotes(): Promise<WarmWordsModeNoteSource[]>;
  getModeDiary(): Promise<WarmWordsModeEntrySource[]>;
  trackEvent(name: string, meta?: Record<string, unknown>): void;
}

/** Грузит и собирает «тёплые слова», трекает открытие один раз. */
export function useWarmWords(deps: WarmWordsDeps): WarmWordsItem[] | null {
  const [items, setItems] = useState<WarmWordsItem[] | null>(null);

  useEffect(() => {
    let ignore = false;
    Promise.all([deps.getModeNotes(), deps.getModeDiary()])
      .then(([notes, entries]) => {
        if (ignore) return;
        const collected = collectWarmWords(notes, entries);
        setItems(collected);
        deps.trackEvent(WARM_WORDS_OPEN_EVENT, {
          count: Math.min(collected.length, 1000),
        });
      })
      .catch(() => {
        if (!ignore) setItems([]);
      });
    return () => {
      ignore = true;
    };
  }, []);

  return items;
}
