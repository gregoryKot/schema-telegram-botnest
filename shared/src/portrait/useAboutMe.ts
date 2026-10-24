// Данные вкладки «Я» / профиля: портрет по потребностям, «Мои схемы»/«Мои
// режимы», «Тёплые слова». Единственная реализация для обоих фронтендов
// (правила №3 и №11): раньше жила в мини-аппе, сайту нужен тот же расчёт.
// api приходит параметром (образец — pair/usePairMechanics), сбой источника —
// через reportError, а не console.error (check-silent-catch).
//
// Общий источник правды с «Мои паттерны» — buildPortrait (portraitData.ts):
// активные схемы здесь не пересчитываем (правило №4). Шесть запросов уходят
// параллельно, но готовность у карточек своя: портрет не ждёт «тёплые слова»
// (замер 2026-08-23: общий Promise.all делал вкладку вдвое дольше соседних).
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

  // Свежие api/reportError без перезапуска эффекта загрузки.
  const apiRef = useRef(api);
  apiRef.current = api;
  const reportRef = useRef(options.reportError);
  reportRef.current = options.reportError;

  useEffect(() => {
    const a = apiRef.current;
    const fail = (what: string) => () => reportRef.current?.(`${what} failed`);
    // Только ready, не данные: провал повторного запроса не подменяет уже
    // показанное пустотой.
    setPortraitReady(false);
    setWarmWordsReady(false);

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

    // Дневник схем не гейтит ни одну карточку: частоты подъезжают по мере
    // готовности.
    a.getSchemaDiary().then(setSchemaEntries).catch(fail('getSchemaDiary'));

    // Дневник режимов нужен и «тёплым словам», и частотам — просим один раз.
    void Promise.all([
      a.getModeDiary().then(setModeEntries).catch(fail('getModeDiary')),
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
    schemaWeekFreq: weekSchemaFrequency(schemaEntries),
    modeWeekFreq: weekModeFrequency(modeEntries),
    warmWordsItems,
  };
}
