// @vitest-environment jsdom
// Дневники главной: лента «сегодня» и счётчики плиток; reloadDiaries
// перечитывает их после разбора, не сбрасывая профиль.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';

vi.mock('../../api', () => ({
  api: { getProfile: vi.fn(), getSchemaDiary: vi.fn(), getModeDiary: vi.fn(), getGratitudeDiary: vi.fn() },
  reportClientError: vi.fn(),
}));
import { api, reportClientError } from '../../api';
import { useTodayData } from './useTodayData';
const m = api as unknown as Record<string, ReturnType<typeof vi.fn>>;

const now = () => new Date().toISOString();
const twoDaysAgo = () => new Date(Date.now() - 2 * 86_400_000).toISOString();

beforeEach(() => {
  vi.clearAllMocks();
  m.getProfile.mockResolvedValue({ name: 'Анна Иванова' });
  m.getSchemaDiary.mockResolvedValue([]);
  m.getModeDiary.mockResolvedValue([]);
  m.getGratitudeDiary.mockResolvedValue([]);
});

describe('useTodayData — дневники главной', () => {
  it('чистый аккаунт: пустая лента, нули, без последней записи', async () => {
    const { result } = renderHook(() => useTodayData(0));
    await waitFor(() => expect(result.current.diariesLoaded).toBe(true));
    expect(result.current).toMatchObject({ feed: [], casesToday: 0, lastAt: null });
  });

  it('разбор — запись режима с fromCase: считается за сегодня; старая запись в ленту не идёт', async () => {
    m.getModeDiary.mockResolvedValue([
      { id: 1, createdAt: twoDaysAgo(), situation: 'давно', fromCase: true },
      { id: 2, createdAt: now(), situation: 'сегодня', fromCase: true },
      { id: 3, createdAt: now(), situation: 'обычная запись режима' },
    ]);
    const { result } = renderHook(() => useTodayData(0));
    await waitFor(() => expect(result.current.diariesLoaded).toBe(true));
    expect(result.current.casesToday).toBe(1);
    expect(result.current.feed.map(e => e.text).sort()).toEqual(['обычная запись режима', 'сегодня']);
    expect(result.current.feed.find(e => e.text === 'сегодня')?.kind).toBe('case');
  });

  it('сохранил → нашёл: после reloadDiaries новая запись появляется в ленте, профиль на месте', async () => {
    m.getSchemaDiary.mockResolvedValue([{ id: 1, createdAt: twoDaysAgo(), trigger: 'Т' }]);
    const { result } = renderHook(() => useTodayData(0));
    await waitFor(() => expect(result.current.diariesLoaded).toBe(true));
    expect(result.current.feed).toEqual([]);

    m.getSchemaDiary.mockResolvedValue([{ id: 2, createdAt: now(), trigger: 'Новая' }]);
    act(() => result.current.reloadDiaries());
    await waitFor(() => expect(result.current.feed).toHaveLength(1));
    expect(result.current.profile).not.toBeNull();
  });

  it('сбой дневников: экран не падает, источник уходит в отчёт, загрузка завершена', async () => {
    m.getSchemaDiary.mockRejectedValue(new Error('500'));
    const { result } = renderHook(() => useTodayData(0));
    await waitFor(() => expect(result.current.diariesLoaded).toBe(true));
    expect(result.current.feed).toEqual([]);
    expect(reportClientError).toHaveBeenCalled();
  });
});
