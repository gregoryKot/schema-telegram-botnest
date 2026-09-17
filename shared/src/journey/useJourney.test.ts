// @vitest-environment jsdom
// Состояние экрана «Мой путь»: загрузка (с трекингом открытия — правило №8),
// пересчёт счётчиков/итога/ленты по фильтру-периоду-сортировке, обработка
// ошибки загрузки. deps — модульный объект (см. комментарий в источнике):
// тест создаёт свой на каждый кейс, как это делает реальный вызывающий код.
import { describe, it, expect, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useJourney, makeJourneyProps, type JourneyDeps } from './useJourney';
import { JOURNEY_OPEN_EVENT } from '../share/analytics';
import type {
  JourneyCounts,
  JourneyData,
  JourneyItem,
  JourneySubtitleSources,
} from './journeyMeta';
import type { JourneyApiLike } from './useJourney';

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

// Заглушка api: методы вне текущего теста явно кидают — виден случайный
// поход не в тот эндпоинт (тот же приём, что в journeyContent.test.ts).
function stubJourneyApi(overrides: Partial<JourneyApiLike>): JourneyApiLike {
  const unimplemented = (name: string) => () => {
    throw new Error(`api.${name} не замокан в этом тесте`);
  };
  const names: (keyof JourneyApiLike)[] = [
    'getJourney',
    'trackEvent',
    'getSchemaDiary',
    'getModeDiary',
    'getGratitudeDiary',
    'getBeliefChecks',
    'getLetters',
    'getFlashcards',
    'getSafePlace',
    'getNote',
    'getPractices',
    'getPlanHistory',
    'ratings',
    'getSchemaNotes',
    'getModeNotes',
    'getYsqHistory',
    'getYsqResult',
  ];
  const base = Object.fromEntries(
    names.map((n) => [n, unimplemented(n)]),
  ) as unknown as JourneyApiLike;
  return { ...base, ...overrides };
}

describe('makeJourneyProps', () => {
  const src: JourneySubtitleSources = {
    getModeById: (id) =>
      id === 'vulnerable_child' ? { name: 'Уязвимый Ребёнок' } : undefined,
    getSchemaById: () => undefined,
  };

  it('deps.getJourney делегирует в api.getJourney', async () => {
    const data: JourneyData = { counts: zeroCounts(), items: [] };
    const api = stubJourneyApi({ getJourney: vi.fn().mockResolvedValue(data) });
    const props = makeJourneyProps(api, src);
    await expect(props.deps.getJourney()).resolves.toBe(data);
  });

  it('deps.trackEvent делегирует имя события в api.trackEvent без meta', () => {
    const trackEvent = vi.fn();
    const props = makeJourneyProps(stubJourneyApi({ trackEvent }), src);
    props.deps.trackEvent('journey_open');
    expect(trackEvent).toHaveBeenCalledWith('journey_open');
  });

  it('subtitle() резолвит имя режима по modeId через переданный src', () => {
    const props = makeJourneyProps(stubJourneyApi({}), src);
    expect(
      props.subtitle({
        type: 'mode_diary',
        at: '2026-07-20',
        modeId: 'vulnerable_child',
      }),
    ).toBe('Уязвимый Ребёнок');
    expect(props.subtitle({ type: 'note', at: '2026-07-20' })).toBeNull();
  });

  it('fetchResult() делегирует в fetchJourneyResult с той же api', async () => {
    const api = stubJourneyApi({
      getLetters: async () => [{ id: 5, text: 'Письмо себе' }],
    });
    const props = makeJourneyProps(api, src);
    const result = await props.fetchResult({
      type: 'letter',
      at: '2026-07-20',
      id: 5,
    });
    expect(result?.parts).toEqual([{ title: undefined, text: 'Письмо себе' }]);
  });

  it('fetchDetail() делегирует в fetchJourneyDetail с той же api', async () => {
    const api = stubJourneyApi({
      getLetters: async () => [{ id: 5, text: 'Письмо себе целиком' }],
    });
    const props = makeJourneyProps(api, src);
    const parts = await props.fetchDetail({
      type: 'letter',
      at: '2026-07-20',
      id: 5,
    });
    expect(parts).toEqual([{ title: undefined, text: 'Письмо себе целиком' }]);
  });
});
