// Состояние экрана «Мой путь» — общая логика обоих фронтендов (правило №3):
// загрузка, событие открытия (правило №8), сортировка/фильтр ленты, счётчики.
// Фронтенд передаёт СТАБИЛЬНЫЙ (модульный) объект deps — иначе эффект будет
// перезапускаться каждый рендер.
import { useEffect, useMemo, useState } from 'react';
import {
  type JourneyData,
  type JourneyGroup,
  type JourneyItem,
  type JourneyPeriod,
  type JourneySubtitleSources,
  type SortDir,
  filterJourneyByPeriod,
  filterJourneyItems,
  journeyItemSubtitle,
  sortJourneyItems,
} from './journeyMeta';
import { journeyStatRows, journeyTotal } from './journeyStats';
import { JOURNEY_OPEN_EVENT } from '../share/analytics';
import {
  type JourneyContentApi,
  type JourneyResultPart,
  fetchJourneyResult,
} from './journeyContent';

export interface JourneyDeps {
  getJourney(): Promise<JourneyData>;
  trackEvent(name: string): void;
}

export interface JourneyApiLike extends JourneyContentApi {
  getJourney(): Promise<JourneyData>;
  trackEvent(name: string, meta?: Record<string, unknown>): void;
}

/**
 * Стабильные deps + резолвер подписи из api и данных конкретного фронтенда.
 * Вызывать на уровне МОДУЛЯ (не в рендере) — иначе useJourney перезапустит
 * загрузку на каждый рендер.
 */
export function makeJourneyProps(
  api: JourneyApiLike,
  src: JourneySubtitleSources,
): {
  deps: JourneyDeps;
  subtitle: (item: JourneyItem) => string | null;
  fetchResult: (item: JourneyItem) => Promise<JourneyResultPart[] | null>;
} {
  return {
    deps: {
      getJourney: () => api.getJourney(),
      trackEvent: (name) => api.trackEvent(name),
    },
    subtitle: (item) => journeyItemSubtitle(item, src),
    fetchResult: (item) => fetchJourneyResult(api, item),
  };
}

export function useJourney(deps: JourneyDeps) {
  const [data, setData] = useState<JourneyData | null>(null);
  const [failed, setFailed] = useState(false);
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [group, setGroup] = useState<JourneyGroup | 'all'>('all');
  const [period, setPeriod] = useState<JourneyPeriod>('all');

  useEffect(() => {
    deps.trackEvent(JOURNEY_OPEN_EVENT);
    deps
      .getJourney()
      .then(setData)
      .catch(() => setFailed(true));
  }, [deps]);

  const stats = useMemo(
    () => (data ? journeyStatRows(data.counts) : []),
    [data],
  );
  const total = data ? journeyTotal(data.counts) : 0;
  const items = useMemo(
    () =>
      data
        ? sortJourneyItems(
            filterJourneyItems(
              filterJourneyByPeriod(data.items, period),
              group,
            ),
            sortDir,
          )
        : [],
    [data, group, period, sortDir],
  );

  return {
    data,
    failed,
    sortDir,
    setSortDir,
    group,
    setGroup,
    period,
    setPeriod,
    stats,
    total,
    items,
  };
}

/** Всё состояние экрана одним объектом — прокидывается в JourneyView. */
export type JourneyState = ReturnType<typeof useJourney>;
