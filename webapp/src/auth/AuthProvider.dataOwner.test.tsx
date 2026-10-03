// @vitest-environment jsdom
// Аудит 2026-10, E1 (webapp): токен другого пользователя, принятый без выхода
// (вход поверх живой сессии, device-link), обязан стереть локальную копию
// клинических данных прежнего — иначе экраны с фолбэком на localStorage
// покажут её новому и автосохранением запишут в его аккаунт.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { AuthProvider } from './AuthProvider';
import { useAuth } from './authContext';
import { resetRefreshLockForTests } from './refreshSession';
import { DATA_OWNER_KEY } from '../../../shared/src/auth/dataOwnerGuard';

const jwt = (sub: string) => `h.${btoa(JSON.stringify({ sub })).replace(/=+$/, '')}.s`;
const wrapper = ({ children }: { children: ReactNode }) => (
  <AuthProvider bootstrapSession={false}>{children}</AuthProvider>
);

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn());
  localStorage.clear();
  sessionStorage.clear();
  resetRefreshLockForTests();
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('AuthProvider: владелец локальных данных', () => {
  it('токен другого пользователя стирает данные прежнего, тот же — нет', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => result.current.setAccessToken(jwt('42'), 900));
    expect(localStorage.getItem(DATA_OWNER_KEY)).toBe('42');
    localStorage.setItem('safe_place', JSON.stringify({ text: 'текст А' }));

    act(() => result.current.setAccessToken(jwt('42'), 900)); // продление сессии
    expect(localStorage.getItem('safe_place')).not.toBeNull();

    act(() => result.current.setAccessToken(jwt('77'), 900)); // другой аккаунт
    expect(localStorage.getItem('safe_place')).toBeNull();
    expect(localStorage.getItem(DATA_OWNER_KEY)).toBe('77');
    expect(localStorage.getItem('auth_seen')).toBe('1');
  });
});
