// @vitest-environment jsdom
// Тесты AuthContext.tsx — TEST_COVERAGE_PLAN этап 2 п.10 (остаток).
//
// Самое ценное здесь — таймер проактивного refresh (scheduleRefresh: за 60с
// до истечения expiresIn, с полом в 5с) и реальное поведение doRefresh при
// провале: очищает accessToken ТОЛЬКО при явном HTTP 401 (см. doRefresh в
// AuthContext.tsx) — сетевая ошибка/5xx токен НЕ трогают. Тесты фиксируют это
// как есть, а не то, что можно было бы ожидать от «logout on any failure».
//
// Контекст не хранит отдельный "user" — только accessToken/isAuthenticated,
// поэтому пункт «login stores token+user state» проверяется как токен+флаг.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { AuthProvider } from './AuthProvider';
import { useAuth } from './authContext';

interface TelegramWindow extends Window {
  Telegram?: { WebApp?: { initData?: string } };
}

function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  } as unknown as Response;
}

function wrapper({ children }: { children: ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>;
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
  delete (window as unknown as TelegramWindow).Telegram;
  localStorage.clear();
  sessionStorage.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

// ── (e) Монтирование — как контекст бутстрапится без явного login() ──────────
describe('монтирование — бутстрап существующей сессии', () => {
  it('без Telegram initData шлёт POST /api/auth/refresh (httpOnly-кука) и авторизует при успехе', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { accessToken: 'cookie-tok', expiresIn: 900 }));

    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/auth/refresh'),
      expect.objectContaining({ method: 'POST', credentials: 'include' }),
    );
    expect(result.current.accessToken).toBe('cookie-tok');
    expect(result.current.isAuthenticated).toBe(true);
  });

  it('с Telegram initData шлёт POST /api/auth/telegram/webapp и не трогает /api/auth/refresh', async () => {
    (window as unknown as TelegramWindow).Telegram = { WebApp: { initData: 'query_id=AAA&user=%7B%7D' } };
    fetchMock.mockResolvedValue(jsonResponse(200, { accessToken: 'tg-tok', expiresIn: 900 }));

    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/auth/telegram/webapp'),
      expect.objectContaining({ method: 'POST', credentials: 'include' }),
    );
    expect(fetchMock).not.toHaveBeenCalledWith(expect.stringContaining('/api/auth/refresh'), expect.anything());
    expect(result.current.accessToken).toBe('tg-tok');
  });

  it('без сессии нигде (refresh 401) остаётся неавторизованным, isLoading снимается', async () => {
    fetchMock.mockResolvedValue(jsonResponse(401, {}));

    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.accessToken).toBeNull();
    expect(result.current.isAuthenticated).toBe(false);
  });
});

// ── (a) login — setAccessToken сохраняет токен ────────────────────────────────
describe('setAccessToken — логин', () => {
  it('сохраняет accessToken и переводит isAuthenticated в true', async () => {
    fetchMock.mockResolvedValue(jsonResponse(401, {})); // на mount сессии нет
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.isAuthenticated).toBe(false);

    act(() => { result.current.setAccessToken('login-tok', 900); });

    expect(result.current.accessToken).toBe('login-tok');
    expect(result.current.isAuthenticated).toBe(true);
  });
});

// ── (b) проактивный refresh — таймер expiresIn-60s ────────────────────────────
describe('проактивный refresh (scheduleRefresh)', () => {
  it('срабатывает ровно за 60с до истечения токена и подменяет accessToken на новый', async () => {
    fetchMock.mockResolvedValue(jsonResponse(401, {}));
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    vi.useFakeTimers();
    act(() => { result.current.setAccessToken('first-tok', 900); }); // delay = (900-60)*1000 = 840000ms
    fetchMock.mockResolvedValue(jsonResponse(200, { accessToken: 'refreshed-tok', expiresIn: 900 }));

    // За 1мс до срабатывания — токен ещё старый.
    await act(async () => { await vi.advanceTimersByTimeAsync(839999); });
    expect(result.current.accessToken).toBe('first-tok');

    await act(async () => { await vi.advanceTimersByTimeAsync(1); });
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/auth/refresh'),
      expect.objectContaining({ method: 'POST', credentials: 'include' }),
    );
    expect(result.current.accessToken).toBe('refreshed-tok');
  });

  it('задержка не уходит ниже пола в 5с, даже если expiresIn совсем маленький', async () => {
    fetchMock.mockResolvedValue(jsonResponse(401, {}));
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    vi.useFakeTimers();
    act(() => { result.current.setAccessToken('short-tok', 30); }); // (30-60)*1000 < 0 -> clamp к 5000мс
    fetchMock.mockResolvedValue(jsonResponse(200, { accessToken: 'renewed', expiresIn: 900 }));

    await act(async () => { await vi.advanceTimersByTimeAsync(4999); });
    expect(result.current.accessToken).toBe('short-tok');

    await act(async () => { await vi.advanceTimersByTimeAsync(1); });
    expect(result.current.accessToken).toBe('renewed');
  });

  it('успешный refresh перепланирует следующий таймер на новый expiresIn', async () => {
    fetchMock.mockResolvedValue(jsonResponse(401, {}));
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    vi.useFakeTimers();
    act(() => { result.current.setAccessToken('tok-1', 120); }); // delay1 = 60000ms
    fetchMock.mockResolvedValue(jsonResponse(200, { accessToken: 'tok-2', expiresIn: 120 })); // delay2 = 60000ms

    await act(async () => { await vi.advanceTimersByTimeAsync(60000); });
    expect(result.current.accessToken).toBe('tok-2');

    fetchMock.mockResolvedValue(jsonResponse(200, { accessToken: 'tok-3', expiresIn: 120 }));
    await act(async () => { await vi.advanceTimersByTimeAsync(60000); });
    expect(result.current.accessToken).toBe('tok-3');
  });
});

// ── (c) провал refresh — реальное поведение, не предположение ────────────────
describe('провал проактивного refresh', () => {
  it('явный 401 логаутит — accessToken очищается', async () => {
    fetchMock.mockResolvedValue(jsonResponse(401, {}));
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    vi.useFakeTimers();
    act(() => { result.current.setAccessToken('will-expire', 900); });
    fetchMock.mockResolvedValue(jsonResponse(401, {})); // refresh-кука отозвана/истекла

    await act(async () => { await vi.advanceTimersByTimeAsync(840000); });

    expect(result.current.accessToken).toBeNull();
    expect(result.current.isAuthenticated).toBe(false);
  });

  it('сетевая ошибка (fetch бросает) НЕ очищает accessToken — clearOnFailure срабатывает только на 401', async () => {
    fetchMock.mockResolvedValue(jsonResponse(401, {}));
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    vi.useFakeTimers();
    act(() => { result.current.setAccessToken('still-valid', 900); });
    fetchMock.mockRejectedValue(new Error('network down'));

    await act(async () => { await vi.advanceTimersByTimeAsync(840000); });

    // doRefresh() ловит исключение в catch{} и просто возвращает false —
    // accessToken старый (возможно уже просроченный) остаётся в стейте.
    expect(result.current.accessToken).toBe('still-valid');
  });
});

// ── refreshToken() — прямой вызов (как из api.ts при 401 на обычном запросе) ─
describe('refreshToken() — прямой вызов', () => {
  it('успех обновляет accessToken и возвращает true', async () => {
    fetchMock.mockResolvedValue(jsonResponse(401, {}));
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    fetchMock.mockResolvedValue(jsonResponse(200, { accessToken: 'manual-tok', expiresIn: 900 }));
    let ok = false;
    await act(async () => { ok = await result.current.refreshToken(); });

    expect(ok).toBe(true);
    expect(result.current.accessToken).toBe('manual-tok');
  });

  it('провал (401) возвращает false и очищает accessToken', async () => {
    fetchMock.mockResolvedValue(jsonResponse(401, {}));
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    act(() => { result.current.setAccessToken('will-be-cleared', 900); });

    fetchMock.mockResolvedValue(jsonResponse(401, {}));
    let ok = true;
    await act(async () => { ok = await result.current.refreshToken(); });

    expect(ok).toBe(false);
    expect(result.current.accessToken).toBeNull();
  });
});

// ── (d) logout ────────────────────────────────────────────────────────────────
describe('logout', () => {
  it('очищает accessToken/isAuthenticated и шлёт POST /api/auth/logout', async () => {
    fetchMock.mockResolvedValue(jsonResponse(401, {}));
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    act(() => { result.current.setAccessToken('tok', 900); });

    fetchMock.mockResolvedValue(jsonResponse(200, {}));
    await act(async () => { await result.current.logout(); });

    expect(result.current.accessToken).toBeNull();
    expect(result.current.isAuthenticated).toBe(false);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/auth/logout'),
      expect.objectContaining({ method: 'POST', credentials: 'include' }),
    );
  });

  it('logout(true) добавляет ?all=true — разлогин со всех устройств', async () => {
    fetchMock.mockResolvedValue(jsonResponse(401, {}));
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    fetchMock.mockResolvedValue(jsonResponse(200, {}));
    await act(async () => { await result.current.logout(true); });

    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('/api/auth/logout?all=true'), expect.anything());
  });

  it('сохраняет app_theme/cookie_consent в localStorage, остальное (клинические черновики) чистит; sessionStorage — целиком', async () => {
    localStorage.setItem('app_theme', 'dark');
    localStorage.setItem('cookie_consent', 'accepted');
    localStorage.setItem('some_clinical_draft', 'secret note');
    sessionStorage.setItem('temp', '1');

    fetchMock.mockResolvedValue(jsonResponse(401, {}));
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    fetchMock.mockResolvedValue(jsonResponse(200, {}));
    await act(async () => { await result.current.logout(); });

    expect(localStorage.getItem('app_theme')).toBe('dark');
    expect(localStorage.getItem('cookie_consent')).toBe('accepted');
    expect(localStorage.getItem('some_clinical_draft')).toBeNull();
    expect(sessionStorage.getItem('temp')).toBeNull();
  });

  it('завершает логаут даже если запрос на сервер упал (fetch throws)', async () => {
    fetchMock.mockResolvedValue(jsonResponse(401, {}));
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    act(() => { result.current.setAccessToken('tok', 900); });

    fetchMock.mockRejectedValue(new Error('offline'));
    await act(async () => { await result.current.logout(); });

    expect(result.current.accessToken).toBeNull();
  });

  it('отменяет запланированный проактивный refresh — после логаута таймер не стреляет', async () => {
    fetchMock.mockResolvedValue(jsonResponse(401, {}));
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    vi.useFakeTimers();
    act(() => { result.current.setAccessToken('tok', 900); });

    fetchMock.mockResolvedValue(jsonResponse(200, {}));
    await act(async () => { await result.current.logout(); });
    fetchMock.mockClear();

    await act(async () => { await vi.advanceTimersByTimeAsync(840000); });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.current.accessToken).toBeNull();
  });
});

// ── useAuth() вне AuthProvider ───────────────────────────────────────────────
describe('useAuth вне AuthProvider', () => {
  it('бросает понятную ошибку вместо тихого undefined', () => {
    expect(() => renderHook(() => useAuth())).toThrow('useAuth must be used within AuthProvider');
  });
});
