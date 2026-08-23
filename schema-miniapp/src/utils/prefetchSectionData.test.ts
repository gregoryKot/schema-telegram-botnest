// @vitest-environment jsdom
// prefetchOtherSectionsData — прогрев ДАННЫХ чужих вкладок в простое (см.
// комментарий в prefetchSectionData.ts, разбор залпа 2026-08-23). Тот же
// набор гарантий, что и у preloadSections.test.ts (образец): текущая секция
// не трогается, остальные греются по одной за виток простоя, есть фолбэк на
// setTimeout. Плюс своё: офлайн — план вообще не строится, и счётчик практик
// «Помощи» (перенесённый со старта) приезжает последним шагом и выполняется
// всегда, независимо от текущей вкладки.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const { apiMock } = vi.hoisted(() => ({
  apiMock: {
    getProfile: vi.fn(() => Promise.resolve({})),
    getSchemaDiary: vi.fn(() => Promise.resolve([])),
    getModeDiary: vi.fn(() => Promise.resolve([])),
    getSchemaNotes: vi.fn(() => Promise.resolve([])),
    getTasks: vi.fn(() => Promise.resolve([])),
    getTaskHistory: vi.fn(() => Promise.resolve([])),
    getPracticeSessions: vi.fn(() => Promise.resolve({})),
    getStreak: vi.fn(() => Promise.resolve({})),
    getAchievements: vi.fn(() => Promise.resolve([])),
    getInsights: vi.fn(() => Promise.resolve({})),
    getYsqHistory: vi.fn(() => Promise.resolve([])),
    getModeNotes: vi.fn(() => Promise.resolve([])),
    getPhraseChecks: vi.fn(() => Promise.resolve([])),
    getPractices: vi.fn((id: string) =>
      Promise.resolve(id === 'attachment' ? [{ id: 1 }, { id: 2 }] : []),
    ),
  },
}));

vi.mock('../api', () => ({ api: apiMock }));

import { prefetchOtherSectionsData } from './prefetchSectionData';

function deleteRic(): void {
  Reflect.deleteProperty(window, 'requestIdleCallback');
}

function setOnline(value: boolean): void {
  Object.defineProperty(navigator, 'onLine', {
    value,
    configurable: true,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  deleteRic();
  setOnline(true);
});

afterEach(() => {
  deleteRic();
  setOnline(true);
  vi.useRealTimers();
});

describe('prefetchOtherSectionsData — офлайн', () => {
  it('не строит план и не зовёт api, если сети нет', () => {
    setOnline(false);
    const onCount = vi.fn();
    const rest = prefetchOtherSectionsData('today', onCount);
    expect(rest).toEqual([]);
    expect(apiMock.getProfile).not.toHaveBeenCalled();
    expect(onCount).not.toHaveBeenCalled();
  });
});

describe('prefetchOtherSectionsData — план и приоритет', () => {
  it('планирует все секции кроме текущей, «Сегодня» — без своего прогрева', () => {
    vi.useFakeTimers();
    const rest = prefetchOtherSectionsData('today', vi.fn());
    expect(rest).toEqual(['schemas', 'help', 'profile']);
  });

  it('греет секции по одной за виток простоя, не разом, не трогает текущую', async () => {
    vi.useFakeTimers();
    prefetchOtherSectionsData('today', vi.fn());
    expect(apiMock.getProfile).not.toHaveBeenCalled();

    // Виток 1 — «Паттерны» (schemas): getProfile/getSchemaDiary/getModeDiary.
    await vi.advanceTimersByTimeAsync(200);
    expect(apiMock.getProfile).toHaveBeenCalledTimes(1);
    expect(apiMock.getSchemaDiary).toHaveBeenCalledTimes(1);
    expect(apiMock.getModeDiary).toHaveBeenCalledTimes(1);
    expect(apiMock.getTasks).not.toHaveBeenCalled();

    // Виток 2 — «Помощь»: getTasks/getTaskHistory.
    await vi.advanceTimersByTimeAsync(200);
    expect(apiMock.getTasks).toHaveBeenCalledTimes(1);
    expect(apiMock.getTaskHistory).toHaveBeenCalledTimes(1);
    expect(apiMock.getStreak).not.toHaveBeenCalled();

    // Виток 3 — «Я»: getStreak/getAchievements/getInsights.
    await vi.advanceTimersByTimeAsync(200);
    expect(apiMock.getStreak).toHaveBeenCalledTimes(1);
    expect(apiMock.getAchievements).toHaveBeenCalledTimes(1);
    expect(apiMock.getInsights).toHaveBeenCalledTimes(1);
    expect(apiMock.getPractices).not.toHaveBeenCalled();

    // Последний шаг — счётчик практик «Помощи» (не привязан к вкладке).
    await vi.advanceTimersByTimeAsync(200);
    expect(apiMock.getPractices).toHaveBeenCalledTimes(5);
  });

  it('когда текущая — «Помощь», её данные не греются, но счётчик практик всё равно приезжает', async () => {
    vi.useFakeTimers();
    const rest = prefetchOtherSectionsData('help', vi.fn());
    expect(rest).toEqual(['today', 'schemas', 'profile']);

    // «Сегодня» — без прогрева, сразу следующий виток («Паттерны»).
    await vi.advanceTimersByTimeAsync(200);
    expect(apiMock.getProfile).toHaveBeenCalledTimes(1);
    expect(apiMock.getTasks).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(200); // «Я»
    expect(apiMock.getStreak).toHaveBeenCalledTimes(1);
    expect(apiMock.getTasks).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(200); // счётчик практик — последний шаг
    expect(apiMock.getPractices).toHaveBeenCalledTimes(5);
  });

  it('использует requestIdleCallback вместо setTimeout, когда хост его даёт', async () => {
    const ric = vi.fn((cb: IdleRequestCallback) => {
      cb({ didTimeout: false, timeRemaining: () => 50 });
      return 1;
    });
    window.requestIdleCallback = ric;

    prefetchOtherSectionsData('profile', vi.fn());
    for (let i = 0; i < 10; i++) await Promise.resolve();

    // schemas + help + счётчик практик = 3 витка простоя (profile текущая,
    // today без своего прогрева не расходует виток).
    expect(ric).toHaveBeenCalledTimes(3);
    expect(apiMock.getStreak).not.toHaveBeenCalled();
    expect(apiMock.getPractices).toHaveBeenCalledTimes(5);
  });
});

describe('prefetchOtherSectionsData — счётчик практик «Помощи»', () => {
  it('складывает длины всех 5 списков и отдаёт колбэком', async () => {
    vi.useFakeTimers();
    const onCount = vi.fn();
    prefetchOtherSectionsData('today', onCount);
    await vi.advanceTimersByTimeAsync(800);
    expect(onCount).toHaveBeenCalledWith(2);
  });

  it('падение getPractices не роняет прогрев — колбэк получает 0', async () => {
    vi.useFakeTimers();
    apiMock.getPractices.mockRejectedValueOnce(new Error('offline'));
    const onCount = vi.fn();
    prefetchOtherSectionsData('today', onCount);
    await vi.advanceTimersByTimeAsync(800);
    expect(onCount).toHaveBeenCalledWith(0);
  });

  it('падение одного эндпоинта секции не блокирует следующую секцию', async () => {
    vi.useFakeTimers();
    apiMock.getSchemaDiary.mockRejectedValueOnce(new Error('network'));
    const onCount = vi.fn();
    prefetchOtherSectionsData('today', onCount);
    await vi.advanceTimersByTimeAsync(200); // schemas (одна из них падает)
    await vi.advanceTimersByTimeAsync(200); // help — обязан всё равно стартовать
    expect(apiMock.getTasks).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(200); // profile
    await vi.advanceTimersByTimeAsync(200); // счётчик практик
    expect(onCount).toHaveBeenCalledWith(2);
  });
});
