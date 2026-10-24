// @vitest-environment jsdom
// Обёртка над общим хуком: логика и её тесты — shared/src/portrait/
// useAboutMe.test.ts; здесь проверяется только шов — api мини-аппа и отчёт о
// сбое через reportClientError (не в консоль).
import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useAboutMe } from './useAboutMe';

vi.mock('../../api', () => ({
  api: {
    getProfile: vi.fn().mockRejectedValue(new Error('network')),
    getYsqHistory: vi.fn().mockResolvedValue([]),
    getSchemaDiary: vi.fn().mockResolvedValue([]),
    getModeDiary: vi.fn().mockResolvedValue([]),
    getModeNotes: vi.fn().mockResolvedValue([]),
    getPhraseChecks: vi.fn().mockResolvedValue([]),
  },
  reportClientError: vi.fn(),
}));
import { reportClientError } from '../../api';

afterEach(() => vi.clearAllMocks());

describe('useAboutMe (мини-апп)', () => {
  it('сбой источника уходит в reportClientError с секцией профиля', async () => {
    const { result } = renderHook(() => useAboutMe());
    await waitFor(() => expect(result.current.portraitReady).toBe(true));
    expect(reportClientError).toHaveBeenCalledWith({
      message: 'getProfile failed',
      section: 'profile-about',
    });
  });
});
