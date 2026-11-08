// Данные вкладки «Я» / профиля: портрет (buildPortrait — как «Мои паттерны», №4), «Мои схемы»/
// «Мои режимы», «Тёплые слова» — одна реализация (№3, №11). api — параметром, сбой — reportError.
// Шесть запросов параллельно, готовность у карточек своя: портрет не ждёт «тёплые
// слова» (замер 2026-08-23: общий Promise.all делал вкладку вдвое дольше соседних).
// Дневники схем и режимов — единственное чтение на весь профиль: счётчик записей,
// частоты, «тёплые слова» и лист портрета берут их отсюда (diaries).
import { useEffect, useRef, useState } from 'react';
import { buildPortrait, type Portrait } from './portraitData';
import {
  weekSchemaFrequency,
  weekModeFrequency,
} from '../pattern/patternsSummary';
import {
  collectWarmWords,
  type WarmWordsItem,
  type WarmWordsModeNoteSource,
  type WarmWordsPhraseCheckSource,
} from '../warmWords/collectWarmWords';
import type { SchemaDiaryEntry, ModeDiaryEntry, UserProfile } from '../types';
import type { YsqHistoryEntry } from '../apiTypes';

export interface AboutMeApi {
  getProfile: () => Promise<UserProfile>;
  getYsqHistory: () => Promise<YsqHistoryEntry[]>;
  getSchemaDiary: () => Promise<SchemaDiaryEntry[]>;
  getModeDiary: () => Promise<ModeDiaryEntry[]>;
  getModeNotes: () => Promise<WarmWordsModeNoteSource[]>;
  getPhraseChecks: () => Promise<WarmWordsPhraseCheckSource[]>;
}

export interface AboutMeOptions {
  refreshKey?: number;
  /** Отчёт наверх о сбое источника; текст без персональных данных. */
  reportError?: (message: string) => void;
}

export type AboutMeState = ReturnType<typeof useAboutMe>;
type Load = 'loading' | 'ready' | 'failed';

export function useAboutMe(api: AboutMeApi, options: AboutMeOptions = {}) {
  const { refreshKey } = options;
  const [ysqCompletedAt, setYsqCompletedAt] = useState<string | null>(null);
  const [manualSchemaIds, setManualSchemaIds] = useState<string[]>([]);
  const [activeSchemaIds, setActiveSchemaIds] = useState<string[]>([]);
  const [myModeIds, setMyModeIds] = useState<string[]>([]);
  const [ysqHistory, setYsqHistory] = useState<YsqHistoryEntry[]>([]);
  const [schemaEntries, setSchemaEntries] = useState<SchemaDiaryEntry[]>([]);
  const [modeEntries, setModeEntries] = useState<ModeDiaryEntry[]>([]);
  const [modeNotes, setModeNotes] = useState<WarmWordsModeNoteSource[]>([]);
  const [phraseChecks, setPhraseChecks] = useState<
    WarmWordsPhraseCheckSource[]
  >([]);
  const [portraitReady, setPortraitReady] = useState(false);
  const [warmWordsReady, setWarmWordsReady] = useState(false);
  const [diaries, setDiaries] = useState<Load>('loading');

  // Свежие api/reportError без перезапуска эффекта загрузки.
  const apiRef = useRef(api);
  apiRef.current = api;
  const reportRef = useRef(options.reportError);
  reportRef.current = options.reportError;

  useEffect(() => {
    const a = apiRef.current;
    const fail = (what: string) => () => reportRef.current?.(`${what} failed`);
    // Только ready, не данные: провал повтора не подменяет показанное пустотой.
    setPortraitReady(false);
    setWarmWordsReady(false);
    setDiaries('loading');

    void Promise.all([
      a
        .getProfile()
        .then((p) => {
          setYsqCompletedAt(p.ysq.completedAt);
          setActiveSchemaIds(p.ysq.activeSchemaIds ?? []);
          setManualSchemaIds(p.mySchemaIds ?? []);
          setMyModeIds(p.myModeIds ?? []);
        })
        .catch(fail('getProfile')),
      a.getYsqHistory().then(setYsqHistory).catch(fail('getYsqHistory')),
    ]).finally(() => setPortraitReady(true));

    // Дневник схем карточек не гейтит; дневник режимов нужен и «тёплым словам».
    const settle = (state: Load) => () => setDiaries(state);
    const sd = a.getSchemaDiary().then(setSchemaEntries);
    const md = a.getModeDiary().then(setModeEntries);
    Promise.all([sd, md]).then(settle('ready'), settle('failed'));
    sd.catch(fail('getSchemaDiary'));
    void Promise.all([
      md.catch(fail('getModeDiary')),
      a.getModeNotes().then(setModeNotes).catch(fail('getModeNotes')),
      a.getPhraseChecks().then(setPhraseChecks).catch(fail('getPhraseChecks')),
    ]).finally(() => setWarmWordsReady(true));
  }, [refreshKey]);

  const mySchemaIds = [...new Set([...activeSchemaIds, ...manualSchemaIds])];

  const portrait: Portrait = buildPortrait({
    activeSchemaIds,
    manualSchemaIds,
    myModeIds,
    ysqHistory,
  });

  const warmWordsItems: WarmWordsItem[] = collectWarmWords(
    modeNotes,
    modeEntries,
    phraseChecks,
  );

  return {
    portraitReady,
    warmWordsReady,
    portrait,
    ysqCompletedAt,
    mySchemaIds,
    myModeIds,
    schemaEntries,
    setSchemaEntries,
    modeEntries,
    setModeEntries,
    diaries,
    schemaWeekFreq: weekSchemaFrequency(schemaEntries),
    modeWeekFreq: weekModeFrequency(modeEntries),
    warmWordsItems,
  };
}
