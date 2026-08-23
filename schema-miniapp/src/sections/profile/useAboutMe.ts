// Данные вкладки «Я» (редизайн «Профиля» + identity-слой поверх статистики):
// портрет по доменам, «Мои схемы»/«Мои режимы», «Тёплые слова». Загрузка —
// по образцу ProfileSection (Promise.all, .catch → console.error + null,
// без обнуления при рефетче). Общий источник правды с SchemasSection —
// buildPortrait (shared/src/portrait/portraitData.ts), НЕ пересчитываем
// активные схемы сами (правило №4 — денормализацию не считаем по месту).
import { useEffect, useState } from 'react';
import { api } from '../../api';
import type { YsqHistoryEntry } from '../../api';
import {
  buildPortrait,
  type Portrait,
} from '../../../../shared/src/portrait/portraitData';
import {
  weekSchemaFrequency,
  weekModeFrequency,
} from '../../utils/patternsSummary';
import type { SchemaDiaryEntry, ModeDiaryEntry } from '../../types';
import {
  collectWarmWords,
  type WarmWordsItem,
  type WarmWordsModeNoteSource,
  type WarmWordsPhraseCheckSource,
} from '../../../../shared/src/warmWords/collectWarmWords';

export type AboutMeState = ReturnType<typeof useAboutMe>;

export function useAboutMe(refreshKey?: number) {
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
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setReady(false);
    void Promise.all([
      api
        .getProfile()
        .then((p) => {
          setYsqCompletedAt(p.ysq.completedAt);
          setActiveSchemaIds(p.ysq.activeSchemaIds ?? []);
          setManualSchemaIds(p.mySchemaIds ?? []);
          setMyModeIds(p.myModeIds ?? []);
        })
        .catch((e) => console.error('getProfile failed', e)),
      api
        .getYsqHistory()
        .then(setYsqHistory)
        .catch((e) => console.error('getYsqHistory failed', e)),
      api
        .getSchemaDiary()
        .then(setSchemaEntries)
        .catch((e) => console.error('getSchemaDiary failed', e)),
      api
        .getModeDiary()
        .then(setModeEntries)
        .catch((e) => console.error('getModeDiary failed', e)),
      // «Тёплые слова» (карточка-превью WarmWordsCard) раньше грузились в
      // WarmWordsCard.tsx САМОЙ карточкой при её монтировании — а карточка
      // монтировалась только после готовности этого хука, поэтому её три
      // запроса уходили ВТОРОЙ волной (замер 2026-08-22, 3G: первая волна
      // закрылась на 695мс, вторая — только к 1316мс, лишний круг +621мс).
      // getModeDiary для тёплых слов переиспользуем — тот же modeEntries,
      // что и для портрета выше, второй раз его не просим.
      api
        .getModeNotes()
        .then(setModeNotes)
        .catch((e) => console.error('getModeNotes failed', e)),
      api
        .getPhraseChecks()
        .then(setPhraseChecks)
        .catch((e) => console.error('getPhraseChecks failed', e)),
    ]).finally(() => setReady(true));
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
    ready,
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
