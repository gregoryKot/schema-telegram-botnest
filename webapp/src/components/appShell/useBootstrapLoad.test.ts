// @vitest-environment jsdom
// useBootstrapLoad — одиннадцать фоновых загрузок AppShell на монтировании.
// РЕГРЕССИЯ: раньше каждая глушилась `.catch(() => {})` молча, и самый
// дорогой случай — упавший getProfile() — оставлял терапевта в клиентском
// интерфейсе без кабинета и без объяснения (CLAUDE.md, правило №14).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useBootstrapLoad } from './useBootstrapLoad';

vi.mock('../../api', () => ({
  api: {
    init: vi.fn().mockResolvedValue(undefined),
    recordActivity: vi.fn().mockResolvedValue(undefined),
    getDisclaimer: vi.fn().mockResolvedValue({ accepted: true }),
    acceptDisclaimer: vi.fn().mockResolvedValue(undefined),
    needs: vi.fn().mockResolvedValue([]),
    ratings: vi.fn().mockResolvedValue({}),
    getPendingPlans: vi.fn().mockResolvedValue([]),
    getChildhoodRatings: vi.fn().mockResolvedValue({}),
    getYsqProgress: vi.fn().mockResolvedValue(null),
    getYsqResult: vi.fn().mockResolvedValue(null),
    getProfile: vi.fn().mockResolvedValue({ role: 'CLIENT', name: null, mySchemaIds: [] }),
    getTherapyClients: vi.fn().mockResolvedValue([]),
    getTherapyRelation: vi.fn().mockResolvedValue(null),
  },
  reportClientError: vi.fn(),
}));
import { api, reportClientError } from '../../api';
const mockApi = api as unknown as Record<string, ReturnType<typeof vi.fn>>;
const mockReport = reportClientError as unknown as ReturnType<typeof vi.fn>;

// Микрозадачи вложенной цепочки (getProfile → getTherapyClients/Relation)
// требуют нескольких тиков, прежде чем Promise.allSettled увидит финальный
// исход. setTimeout(0) детерминированно ждёт полного слива очереди микрозадач
// (тот же приём — shared/src/utils/addressFormCache.test.ts).
async function flush() {
  await act(async () => { await new Promise(r => setTimeout(r, 0)); });
}

function setup() {
  const navigate = vi.fn();
  return renderHook(() => useBootstrapLoad({ navigate, initialPathname: '/today' }));
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  sessionStorage.clear();
  mockApi.init.mockResolvedValue(undefined);
  mockApi.recordActivity.mockResolvedValue(undefined);
  mockApi.getDisclaimer.mockResolvedValue({ accepted: true });
  mockApi.acceptDisclaimer.mockResolvedValue(undefined);
  mockApi.needs.mockResolvedValue([]);
  mockApi.ratings.mockResolvedValue({});
  mockApi.getPendingPlans.mockResolvedValue([]);
  mockApi.getChildhoodRatings.mockResolvedValue({});
  mockApi.getYsqProgress.mockResolvedValue(null);
  mockApi.getYsqResult.mockResolvedValue(null);
  mockApi.getProfile.mockResolvedValue({ role: 'CLIENT', name: null, mySchemaIds: [] });
  mockApi.getTherapyClients.mockResolvedValue([]);
  mockApi.getTherapyRelation.mockResolvedValue(null);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('useBootstrapLoad — сбои фоновых источников не глушатся молча', () => {
  it('упавший getProfile() шлёт ровно один отчёт с именем «профиль» — терапевт не должен молча остаться клиентом', async () => {
    mockApi.getProfile.mockRejectedValue(new Error('boom'));
    setup();
    await flush();
    expect(mockReport).toHaveBeenCalledTimes(1);
    expect(mockReport.mock.calls[0][0]).toMatchObject({ section: 'appshell.bootstrap' });
    expect(mockReport.mock.calls[0][0].message).toContain('профиль');
  });

  it('несколько упавших источников разом — всё равно один отчёт с обоими именами (троттлинг)', async () => {
    mockApi.getProfile.mockRejectedValue(new Error('boom'));
    mockApi.getPendingPlans.mockRejectedValue(new Error('boom'));
    setup();
    await flush();
    expect(mockReport).toHaveBeenCalledTimes(1);
    const message = mockReport.mock.calls[0][0].message as string;
    expect(message).toContain('профиль');
    expect(message).toContain('задания');
  });

  it('успех всех источников — reportClientError не вызывается', async () => {
    const { result } = setup();
    await flush();
    expect(result.current.loading).toBe(false);
    expect(mockReport).not.toHaveBeenCalled();
  });
});
