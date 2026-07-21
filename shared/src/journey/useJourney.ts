// Состояние экрана «Мой путь» — общая логика обоих фронтендов (правило №3):
// загрузка, событие открытия (правило №8), сортировка/фильтр ленты, счётчики.
// Фронтенд передаёт СТАБИЛЬНЫЙ (модульный) объект deps — иначе эффект будет
// перезапускаться каждый рендер.
import { useEffect, useMemo, useState } from 'react';
import {
  type JourneyData,
  type JourneyGroup,
  type JourneyItem,
  type JourneySubtitleSources,
  type SortDir,
  filterJourneyItems,
  journeyItemSubtitle,
  journeyStatRows,
  journeyTotal,
  sortJourneyItems,
} from './journeyMeta';
import { JOURNEY_OPEN_EVENT } from '../share/analytics';

export interface JourneyDeps {
  getJourney(): Promise<JourneyData>;
  trackEvent(name: string): void;
}

export interface JourneyApiLike {
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
} {
  return {
    deps: {
      getJourney: () => api.getJourney(),
      trackEvent: (name) => api.trackEvent(name),
    },
    subtitle: (item) => journeyItemSubtitle(item, src),
  };
}

export function useJourney(deps: JourneyDeps) {
  const [data, setData] = useState<JourneyData | null>(null);
  const [failed, setFailed] = useState(false);
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [group, setGroup] = useState<JourneyGroup | 'all'>('all');

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
        ? sortJourneyItems(filterJourneyItems(data.items, group), sortDir)
        : [],
    [data, group, sortDir],
  );

  return {
    data,
    failed,
    sortDir,
    setSortDir,
    group,
    setGroup,
    stats,
    total,
    items,
  };
}

/** Всё состояние экрана одним объектом — прокидывается в JourneyView. */
export type JourneyState = ReturnType<typeof useJourney>;
