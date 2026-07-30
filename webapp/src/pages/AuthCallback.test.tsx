// @vitest-environment jsdom
// returnTo из sessionStorage (auth_return_to) может указывать ВНЕ SPA сайта —
// на мини-апп (/app/…), куда LoginScreen мини-аппа кладёт этот ключ перед
// уходом на OAuth (MULTI_HOST_PLAN.md, шаг 2). У сайта нет react-router
// маршрута /app — navigate() туда покажет пустоту, поэтому такой returnTo
// обязан уйти полным переходом (window.location.replace), а обычный
// внутренний маршрут — как раньше, через navigate().
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, waitFor, cleanup } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from '../auth/AuthProvider';
import { AuthCallback } from './AuthCallback';

function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  } as unknown as Response;
}

let fetchMock: ReturnType<typeof vi.fn>;
// window.location.replace не переопределяется через vi.spyOn в jsdom
// (навигация — не конфигурируемое свойство) — подменяем сам объект location.
const originalLocation = window.location;
let replaceSpy: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn().mockResolvedValue(jsonResponse(401, {}));
  vi.stubGlobal('fetch', fetchMock);
  sessionStorage.clear();
  replaceSpy = vi.fn();
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: { ...originalLocation, replace: replaceSpy },
  });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  sessionStorage.clear();
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: originalLocation,
  });
});

// MemoryRouter управляет только react-router-местоположением — AuthCallback
// читает НАСТОЯЩИЙ window.location.hash (это токен из редиректа бэкенда),
// поэтому хэш нужно положить в стаб window.location отдельно.
function renderAt(hash: string, returnTo?: string) {
  if (returnTo) sessionStorage.setItem('auth_return_to', returnTo);
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: { ...originalLocation, hash, replace: replaceSpy },
  });
  return render(
    <MemoryRouter initialEntries={['/auth/callback']}>
      <AuthProvider>
        <Routes>
          <Route path="/auth/callback" element={<AuthCallback />} />
          <Route path="/today" element={<div>today-page</div>} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  );
}

describe('AuthCallback — returnTo ведёт на мини-апп (/app/…)', () => {
  it('уходит полным переходом через window.location.replace, а не navigate', async () => {
    const { queryByText } = renderAt('#access_token=tok123&expires_in=900', '/app/');

    await waitFor(() => expect(replaceSpy).toHaveBeenCalledWith('/app/'));
    // navigate() к SPA-маршруту не сработал — «/today» не отрендерился.
    expect(queryByText('today-page')).toBeNull();
  });
});

describe('AuthCallback — returnTo ведёт на обычный маршрут сайта', () => {
  it('уходит через navigate(), без window.location.replace', async () => {
    const { findByText } = renderAt('#access_token=tok123&expires_in=900', '/today');

    await findByText('today-page');
    expect(replaceSpy).not.toHaveBeenCalled();
  });

  it('без сохранённого returnTo — дефолт /today через navigate()', async () => {
    const { findByText } = renderAt('#access_token=tok123&expires_in=900');

    await findByText('today-page');
    expect(replaceSpy).not.toHaveBeenCalled();
  });
});
