// @vitest-environment jsdom
// Состояние экрана «Мой путь»: загрузка (с трекингом открытия — правило №8),
// пересчёт счётчиков/итога/ленты по фильтру-периоду-сортировке, обработка
// ошибки загрузки. deps — модульный объект (см. комментарий в источнике):
// тест создаёт свой на каждый кейс, как это делает реальный вызывающий код.
import { describe, it, expect, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useJourney, type JourneyDeps } from './useJourney';
import { JOURNEY_OPEN_EVENT } from '../share/analytics';
import type { JourneyCounts, JourneyData, JourneyItem } from './journeyMeta';

function zeroCounts(): JourneyCounts {
  return {
    trackerDays: 0,
    notes: 0,
    schemaDiary: 0,
    modeDiary: 0,
    gratitudeDays: 0,
    practices: 0,
    plansDone: 0,
    ysqTests: 0,
    childhoodDone: false,
    beliefChecks: 0,
    letters: 0,
    flashcards: 0,
    safePlace: false,
    schemaNotes: 0,
    modeNotes: 0,
    breathingSessions: 0,
    groundingSessions: 0,
    stopSessions: 0,
  };
}

const ITEMS: JourneyItem[] = [
  { type: 'gratitude', at: '2026-07-21T10:00:00Z' },
  { type: 'tracker_day', at: '2026-01-01T10:00:00Z' },
];

describe('useJourney', () => {
  it('трекает открытие один раз при монтировании', async () => {
    const trackEvent = vi.fn();
    const deps: JourneyDeps = {
      getJourney: vi
        .fn()
        .mockResolvedValue({ counts: zeroCounts(), items: [] }),
      trackEvent,
    };
    renderHook(() => useJourney(deps));
    expect(trackEvent).toHaveBeenCalledWith(JOURNEY_OPEN_EVENT);
    expect(trackEvent).toHaveBeenCalledTimes(1);
  });

  it('загруженные данные дают total и items (без фильтра — по умолчанию все)', async () => {
    const data: JourneyData = {
      counts: { ...zeroCounts(), gratitudeDays: 1, trackerDays: 1 },
      items: ITEMS,
    };
    const deps: JourneyDeps = {
      getJourney: vi.fn().mockResolvedValue(data),
      trackEvent: vi.fn(),
    };
    const { result } = renderHook(() => useJourney(deps));
    await waitFor(() => expect(result.current.data).not.toBeNull());
    expect(result.current.total).toBeGreaterThan(0);
    expect(result.current.items).toHaveLength(2);
    expect(result.current.failed).toBe(false);
  });

  it('пустая лента (чистый аккаунт) — total=0, items=[] — не выдуманные числа', async () => {
    const deps: JourneyDeps = {
      getJourney: vi
        .fn()
        .mockResolvedValue({ counts: zeroCounts(), items: [] }),
      trackEvent: vi.fn(),
    };
    const { result } = renderHook(() => useJourney(deps));
    await waitFor(() => expect(result.current.data).not.toBeNull());
    expect(result.current.total).toBe(0);
    expect(result.current.items).toEqual([]);
  });

  it('ошибка загрузки — failed=true, данных нет', async () => {
    const deps: JourneyDeps = {
      getJourney: vi.fn().mockRejectedValue(new Error('network')),
      trackEvent: vi.fn(),
    };
    const { result } = renderHook(() => useJourney(deps));
    await waitFor(() => expect(result.current.failed).toBe(true));
    expect(result.current.data).toBeNull();
  });

  it('период «неделя» фильтрует старые записи из items', async () => {
    const deps: JourneyDeps = {
      getJourney: vi
        .fn()
        .mockResolvedValue({ counts: zeroCounts(), items: ITEMS }),
      trackEvent: vi.fn(),
    };
    const { result } = renderHook(() => useJourney(deps));
    await waitFor(() => expect(result.current.data).not.toBeNull());
    act(() => result.current.setPeriod('week'));
    // ITEMS[1] датирован январём — вне недельного окна от «сейчас» теста.
    expect(result.current.items.length).toBeLessThan(2);
  });

  it('sortDir=asc переворачивает порядок ленты относительно desc', async () => {
    const deps: JourneyDeps = {
      getJourney: vi
        .fn()
        .mockResolvedValue({ counts: zeroCounts(), items: ITEMS }),
      trackEvent: vi.fn(),
    };
    const { result } = renderHook(() => useJourney(deps));
    await waitFor(() => expect(result.current.data).not.toBeNull());
    const desc = result.current.items.map((i) => i.at);
    act(() => result.current.setSortDir('asc'));
    const asc = result.current.items.map((i) => i.at);
    expect(asc).toEqual([...desc].reverse());
  });
});
