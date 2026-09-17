// @vitest-environment jsdom
// useQuizzes — загрузка контента мини-тестов (0% покрытия). Ключевая
// связка правила ты/вы: аноним всегда получает «ты»-контент, залогиненный
// с формой «вы» — «вы»-контент; иначе юзер с «вы» увидел бы «ты» в тестах.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useQuizzes } from './useQuizzes';
import { AuthContext, type AuthState } from '../auth/authContext';
import type { ReactNode } from 'react';

const getQuizzes = vi.fn();
const getSettings = vi.fn();
vi.mock('../api', () => ({
  api: {
    getQuizzes: (...a: unknown[]) => getQuizzes(...a),
    getSettings: (...a: unknown[]) => getSettings(...a),
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
  getQuizzes.mockResolvedValue({ quizzes: [] });
});

afterEach(() => {
  vi.clearAllMocks();
});

function auth(overrides: Partial<AuthState> = {}): AuthState {
  return {
    accessToken: null, isLoading: false, isAuthenticated: false,
    setAccessToken: vi.fn(), logout: vi.fn(), refreshToken: vi.fn(),
    ...overrides,
  };
}

function wrapper(value: AuthState) {
  return ({ children }: { children: ReactNode }) => (
    <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
  );
}

describe('useQuizzes — анонимный визитор', () => {
  it('пока isLoading — не запрашивает тесты', () => {
    renderHook(() => useQuizzes(), { wrapper: wrapper(auth({ isLoading: true })) });
    expect(getQuizzes).not.toHaveBeenCalled();
  });

  it('аноним запрашивает тесты без формы обращения («ты» по умолчанию на бэке)', async () => {
    const { result } = renderHook(() => useQuizzes(), { wrapper: wrapper(auth()) });
    await waitFor(() => expect(getQuizzes).toHaveBeenCalledWith(undefined));
    await waitFor(() => expect(result.current.quizzes).toEqual([]));
  });
});

describe('useQuizzes — залогиненный юзер', () => {
  it('форма «вы» в настройках — запрашивает вы-контент', async () => {
    getSettings.mockResolvedValue({ addressForm: 'vy' });
    renderHook(() => useQuizzes(), { wrapper: wrapper(auth({ isAuthenticated: true, accessToken: 't' })) });
    await waitFor(() => expect(getQuizzes).toHaveBeenCalledWith('vy'));
  });

  it('форма «ты» (или не выбрана) — запрашивает без параметра формы', async () => {
    getSettings.mockResolvedValue({ addressForm: null });
    renderHook(() => useQuizzes(), { wrapper: wrapper(auth({ isAuthenticated: true, accessToken: 't' })) });
    await waitFor(() => expect(getQuizzes).toHaveBeenCalledWith(undefined));
  });

  it('провал загрузки настроек не блокирует загрузку тестов (fallback «ты»)', async () => {
    getSettings.mockRejectedValue(new Error('network'));
    renderHook(() => useQuizzes(), { wrapper: wrapper(auth({ isAuthenticated: true, accessToken: 't' })) });
    await waitFor(() => expect(getQuizzes).toHaveBeenCalledWith(undefined));
  });
});

describe('useQuizzes — ошибка', () => {
  it('провал запроса тестов возвращает error=true, а не мусорные данные', async () => {
    getQuizzes.mockRejectedValue(new Error('network'));
    const { result } = renderHook(() => useQuizzes(), { wrapper: wrapper(auth()) });
    await waitFor(() => expect(result.current.error).toBe(true));
    expect(result.current.quizzes).toBeNull();
  });
});
