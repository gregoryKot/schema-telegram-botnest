// @vitest-environment jsdom
// useAboutMe — happy-path: грузит 4 источника параллельно, склеивает
// mySchemaIds (активные ⋃ ручные), считает недельную частоту (общий слой
// patternsSummary — не пересчитываем здесь).
import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useAboutMe } from './useAboutMe';

vi.mock('../../api', () => ({
  api: {
    getProfile: vi.fn(),
    getYsqHistory: vi.fn(),
    getSchemaDiary: vi.fn(),
    getModeDiary: vi.fn(),
  },
}));
import { api } from '../../api';
const mockApi = api as unknown as Record<string, ReturnType<typeof vi.fn>>;

afterEach(() => {
  vi.clearAllMocks();
});

describe('useAboutMe — happy path', () => {
  it('объединяет активные и ручные схемы без дублей, ready=true после загрузки', async () => {
    mockApi.getProfile.mockResolvedValue({
      name: 'Аня',
      role: 'CLIENT',
      ysq: {
        completedAt: '2026-08-01T00:00:00.000Z',
        activeSchemaIds: ['abandonment', 'mistrust'],
      },
      notifications: {
        enabled: false,
        reminderEnabled: false,
        timezone: 'UTC',
        localHour: 9,
      },
      streak: 0,
      lastActivity: {
        needsTracker: null,
        schemaDiary: null,
        modeDiary: null,
        gratitudeDiary: null,
      },
      mySchemaIds: ['mistrust', 'defectiveness'],
      myModeIds: ['vulnerable_child'],
    });
    mockApi.getYsqHistory.mockResolvedValue([]);
    mockApi.getSchemaDiary.mockResolvedValue([
      { id: 1, createdAt: '2026-08-10', schemaIds: ['abandonment'] } as never,
    ]);
    mockApi.getModeDiary.mockResolvedValue([]);

    const { result } = renderHook(() => useAboutMe());
    await waitFor(() => expect(result.current.ready).toBe(true));

    expect(new Set(result.current.mySchemaIds)).toEqual(
      new Set(['abandonment', 'mistrust', 'defectiveness']),
    );
    expect(result.current.myModeIds).toEqual(['vulnerable_child']);
    expect(result.current.ysqCompletedAt).toBe('2026-08-01T00:00:00.000Z');
    expect(result.current.portrait.totalSchemas).toBe(3);
  });

  it('провал одного источника не роняет остальные (each .catch → null/[])', async () => {
    mockApi.getProfile.mockRejectedValue(new Error('network'));
    mockApi.getYsqHistory.mockResolvedValue([]);
    mockApi.getSchemaDiary.mockResolvedValue([]);
    mockApi.getModeDiary.mockResolvedValue([]);

    const { result } = renderHook(() => useAboutMe());
    await waitFor(() => expect(result.current.ready).toBe(true));

    expect(result.current.mySchemaIds).toEqual([]);
    expect(result.current.portrait.totalSchemas).toBe(0);
  });
});
