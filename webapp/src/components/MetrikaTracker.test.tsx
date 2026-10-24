// @vitest-environment jsdom
// MetrikaTracker: проводка «есть ли сессия» в шлюз Метрики и хит на смену
// маршрута (решение D-4). Проверяем связку на настоящем шлюзе и настоящем
// metrika.ts (правило №14: тест — на шве, а не по обе стороны от него).
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AuthContext, type AuthState } from '../auth/authContext';
import { MetrikaTracker } from './MetrikaTracker';

const scriptLoaded = () => !!document.querySelector('script[src*="mc.yandex.ru"]');
const hits = () =>
  ((window as unknown as { ym?: { a?: unknown[][] } }).ym?.a ?? []).filter((c) => c[1] === 'hit');

function auth(over: Partial<AuthState>): AuthState {
  return {
    accessToken: null, isLoading: false, isAuthenticated: false, authError: null,
    setAccessToken: vi.fn(), logout: vi.fn(), refreshToken: vi.fn(), ...over,
  };
}

function mount(path: string, state: Partial<AuthState>) {
  window.history.replaceState(null, '', path);
  return render(
    <AuthContext.Provider value={auth(state)}>
      <MemoryRouter initialEntries={[path]}>
        <MetrikaTracker />
      </MemoryRouter>
    </AuthContext.Provider>,
  );
}

beforeEach(() => {
  delete (window as unknown as { __ym_loaded?: boolean }).__ym_loaded;
  delete (window as unknown as { ym?: unknown }).ym;
  document.querySelectorAll('script[src*="mc.yandex.ru"]').forEach((s) => s.remove());
});
afterEach(cleanup);

describe('MetrikaTracker', () => {
  it('анонимно на «/» — тег грузится, хит уходит', () => {
    mount('/', {});
    expect(scriptLoaded()).toBe(true);
    expect(hits().length).toBe(1);
  });

  it('анонимно на /diary — молчит', () => {
    mount('/diary', {});
    expect(scriptLoaded()).toBe(false);
  });

  it('со входом на «/» — молчит', () => {
    mount('/', { isAuthenticated: true, accessToken: 't' });
    expect(scriptLoaded()).toBe(false);
  });

  it('пока сессия проверяется (isLoading) — молчит: кука могла уже быть', () => {
    mount('/', { isLoading: true });
    expect(scriptLoaded()).toBe(false);
  });

  it('проверка завершилась без сессии — счётчик включается', () => {
    const { rerender } = mount('/', { isLoading: true });
    expect(scriptLoaded()).toBe(false);
    rerender(
      <AuthContext.Provider value={auth({ isLoading: false })}>
        <MemoryRouter initialEntries={['/']}>
          <MetrikaTracker />
        </MemoryRouter>
      </AuthContext.Provider>,
    );
    expect(scriptLoaded()).toBe(true);
  });
});
