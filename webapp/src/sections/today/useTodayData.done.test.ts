// @vitest-environment jsdom
// «Сделано сегодня» для фокус-карточки считается из дневников, а перечитывание
// после записи (reloadDiaries) обновляет его без сброса профиля.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';

vi.mock('../../api', () => ({
  api: {
    getProfile: vi.fn(), getSchemaDiary: vi.fn(), getModeDiary: vi.fn(), getGratitudeDiary: vi.fn(),
    getTherapyRelation: vi.fn(), history: vi.fn(),
  },
  reportClientError: vi.fn(),
}));
import { api } from '../../api';
import { useTodayData } from './useTodayData';
const m = api as unknown as Record<string, ReturnType<typeof vi.fn>>;

const now = () => new Date().toISOString();
const todayDay = () => new Date().toISOString().slice(0, 10);

beforeEach(() => {
  vi.clearAllMocks();
  m.getProfile.mockResolvedValue({ mySchemaIds: [] });
  m.getModeDiary.mockResolvedValue([]);
  m.getTherapyRelation.mockResolvedValue(null);
  m.history.mockResolvedValue([]);
});

describe('useTodayData — todayDone', () => {
  it('пустые дневники: ничего не сделано, благодарности нет', async () => {
    m.getSchemaDiary.mockResolvedValue([]);
    m.getGratitudeDiary.mockResolvedValue([]);
    const { result } = renderHook(() => useTodayData(0));
    await waitFor(() => expect(result.current.diariesLoaded).toBe(true));
    expect(result.current.todayDone).toEqual({ schema: false, mode: false, gratitude: false });
    expect(result.current.gratitudeToday).toBeUndefined();
  });

  it('запись за вчера не считается, а после reloadDiaries новая запись видна', async () => {
    const yesterday = new Date(Date.now() - 2 * 86_400_000).toISOString();
    m.getSchemaDiary.mockResolvedValue([{ id: 1, createdAt: yesterday, trigger: 'Т' }]);
    m.getGratitudeDiary.mockResolvedValue([]);
    const { result } = renderHook(() => useTodayData(0));
    await waitFor(() => expect(result.current.diariesLoaded).toBe(true));
    expect(result.current.todayDone.schema).toBe(false);

    m.getSchemaDiary.mockResolvedValue([{ id: 2, createdAt: now(), trigger: 'Т' }]);
    m.getGratitudeDiary.mockResolvedValue([{ id: 3, date: todayDay(), items: ['a', 'b'] }]);
    act(() => result.current.reloadDiaries());
    await waitFor(() => expect(result.current.todayDone.schema).toBe(true));
    expect(result.current.todayDone.gratitude).toBe(true);
    expect(result.current.gratitudeToday).toEqual(['a', 'b']);
    expect(result.current.profile).not.toBeNull();
  });
});
