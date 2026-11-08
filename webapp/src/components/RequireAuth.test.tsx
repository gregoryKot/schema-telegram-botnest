// @vitest-environment jsdom
// RequireAuth — точка, где кабинет получает окно кода 2FA (S12, аудит 2026-11):
// без StepUpProvider сверху ручки привязки и отвязки отдавали бы 403 «нужен
// код» обычной ошибкой, и у человека с 2FA привязка не работала бы вовсе.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { useContext } from 'react';
import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

vi.mock('../api', () => ({
  api: { getSettings: vi.fn().mockResolvedValue({ addressForm: 'ty' }), updateSettings: vi.fn() },
}));

import { AuthContext, type AuthState } from '../auth/authContext';
import { RequireAuth } from './RequireAuth';
import { StepUpContext } from './stepUp/stepUpContext';
import { takeLaunchParam } from '../../../shared/src/host/startParam';

const auth = (over: Partial<AuthState> = {}): AuthState => ({
  accessToken: 'tok', isLoading: false, isAuthenticated: true,
  setAccessToken: vi.fn(), logout: vi.fn(), refreshToken: vi.fn().mockResolvedValue(true), ...over,
});

function Probe() {
  return <div>{useContext(StepUpContext) ? 'окно кода есть' : 'окна кода нет'}</div>;
}

afterEach(cleanup);

describe('RequireAuth', () => {
  it('страницы кабинета получают окно кода 2FA (StepUpProvider)', async () => {
    render(
      <MemoryRouter initialEntries={['/account']}>
        <AuthContext.Provider value={auth()}>
          <Routes>
            <Route element={<RequireAuth />}>
              <Route path="/account" element={<Probe />} />
            </Route>
            <Route path="/login" element={<div>login</div>} />
          </Routes>
        </AuthContext.Provider>
      </MemoryRouter>,
    );
    expect(await screen.findByText('окно кода есть')).toBeTruthy();
  });

  // Аудит 2026-11, U3: приглашение терапевта — ссылка на сайт. Без входа
  // RequireAuth уводит на /login, и `?startapp=therapy_…` терялся: после входа
  // клиент попадал на «Сегодня» без подключения.
  it('без входа параметр запуска из адреса ждёт входа, а не теряется на /login', async () => {
    localStorage.clear();
    render(
      <MemoryRouter initialEntries={['/today?startapp=therapy_ABC']}>
        <AuthContext.Provider value={auth({ isAuthenticated: false, accessToken: null })}>
          <Routes>
            <Route element={<RequireAuth />}>
              <Route path="/today" element={<div>сегодня</div>} />
            </Route>
            <Route path="/login" element={<div>login</div>} />
          </Routes>
        </AuthContext.Provider>
      </MemoryRouter>,
    );
    expect(await screen.findByText('login')).toBeTruthy();
    expect(takeLaunchParam()).toBe('therapy_ABC');
  });
});
