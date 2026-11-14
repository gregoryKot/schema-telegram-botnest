// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AuthContext, type AuthState } from '../../auth/authContext';
import { cacheForm } from '../../../../shared/src/utils/addressFormCache';
import { LoginRoute } from './LoginRoute';

vi.mock('../../../../shared/src/host', () => ({
  getHost: () => ({ id: 'web', sessionExchange: () => null }),
}));
vi.mock('../../api', () => ({ reportClientError: vi.fn() }));

const auth: AuthState = {
  accessToken: null, isAuthenticated: false, isLoading: false, authError: null,
  setAccessToken: vi.fn(), getAccessToken: () => null, logout: vi.fn(), refreshToken: vi.fn(),
};

function renderRoute() {
  return render(
    <MemoryRouter initialEntries={['/login']}>
      <AuthContext.Provider value={auth}>
        <LoginRoute />
      </AuthContext.Provider>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  cleanup();
  localStorage.clear();
  vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})));
});

afterEach(() => vi.restoreAllMocks());

describe('LoginRoute — форма обращения на входе из кэша', () => {
  it('вы-пользователь из кэша видит весь экран на «вы»', () => {
    cacheForm('vy');
    renderRoute();
    expect(screen.getByText(/^Войдите, чтобы продолжить\./)).toBeTruthy();
    expect(screen.getByTestId('login-consent-note').textContent).toMatch(/подтверждаете/);
  });

  it('без кэша — «ты»', () => {
    renderRoute();
    expect(screen.getByText(/^Войди, чтобы продолжить\./)).toBeTruthy();
    expect(screen.getByTestId('login-consent-note').textContent).toMatch(/подтверждаешь/);
  });

  it('заблокированное хранилище не роняет вход, форма — «ты»', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
    renderRoute();
    expect(screen.getByText(/^Войди, чтобы продолжить\./)).toBeTruthy();
  });
});
