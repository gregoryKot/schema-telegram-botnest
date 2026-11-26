// @vitest-environment jsdom
// Мета квадрата «Мне плохо» — число с сервера, а не длина списка: расшифрованные карточки ради одной
// цифры по сети не едут, и число не упирается в 30 записей, которые отдаёт список.
import { describe, it, expect, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

vi.mock('../../api', () => ({
  api: {
    getPracticeSessions: vi.fn().mockResolvedValue({ breathing: 0, grounding: 0, stop: 0 }),
    getFlashcards: vi.fn(),
    getFlashcardsCount: vi.fn().mockResolvedValue({ count: 45 }),
  },
}));
import { api } from '../../api';
import { useQuickCounts } from './useQuickCounts';

describe('useQuickCounts — «Мне плохо»', () => {
  it('берёт число с сервера, список карточек не грузит', async () => {
    const { result } = renderHook(() => useQuickCounts(true));
    await waitFor(() => expect(result.current.sos).toBe(45));
    expect(api.getFlashcardsCount).toHaveBeenCalledTimes(1);
    expect(api.getFlashcards).not.toHaveBeenCalled();
  });
});
