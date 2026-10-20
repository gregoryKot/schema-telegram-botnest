// @vitest-environment jsdom
// Счётчики «Каталогов» на «Практике» (паритет с toolRows мини-аппа): число — из
// реальных данных, при сбое/загрузке цифры нет вообще, а не «0».
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { catalogCountLabel, catalogRowSub, useCatalogCounts } from './catalogCounts';

vi.mock('../../api', () => ({
  api: { getPractices: vi.fn(), getPlanHistory: vi.fn() },
}));
import { api } from '../../api';
const mockApi = api as unknown as Record<string, ReturnType<typeof vi.fn>>;

beforeEach(() => vi.clearAllMocks());

describe('catalogCountLabel / catalogRowSub', () => {
  it('склоняет слова и называет пустое состояние', () => {
    expect(catalogCountLabel('practices', 1)).toBe('1 практика');
    expect(catalogCountLabel('practices', 3)).toBe('3 практики');
    expect(catalogCountLabel('practices', 12)).toBe('12 практик');
    expect(catalogCountLabel('practices', 0)).toBe('Нет практик');
    expect(catalogCountLabel('plans', 1)).toBe('1 план');
    expect(catalogCountLabel('plans', 2)).toBe('2 плана');
    expect(catalogCountLabel('plans', 5)).toBe('5 планов');
    expect(catalogCountLabel('plans', 0)).toBe('История пуста');
  });

  it('неизвестное число: подписи нет, остаётся пояснение', () => {
    expect(catalogCountLabel('plans', null)).toBeNull();
    expect(catalogRowSub('plans', null, 'Планы поддержки')).toBe('Планы поддержки');
    expect(catalogRowSub('plans', 2, 'Планы поддержки')).toBe('2 плана · Планы поддержки');
  });
});

describe('useCatalogCounts', () => {
  it('суммирует практики по всем пяти потребностям и считает планы', async () => {
    mockApi.getPractices.mockImplementation((id: string) => Promise.resolve(id === 'play' ? [1, 2] : [1]));
    mockApi.getPlanHistory.mockResolvedValue([1, 2, 3]);
    const { result } = renderHook(() => useCatalogCounts());
    expect(result.current).toEqual({ practices: null, plans: null });
    await waitFor(() => expect(result.current).toEqual({ practices: 6, plans: 3 }));
    expect(mockApi.getPlanHistory).toHaveBeenCalledWith(30);
  });

  it('сбой одного запроса не превращается в ноль и не трогает второй', async () => {
    mockApi.getPractices.mockRejectedValue(new Error('offline'));
    mockApi.getPlanHistory.mockResolvedValue([]);
    const { result } = renderHook(() => useCatalogCounts());
    await waitFor(() => expect(result.current.plans).toBe(0));
    expect(result.current.practices).toBeNull();
  });
});
