// @vitest-environment jsdom
// useGoogleOneTap — необязательный путь входа: всплывашка Google отдаёт id_token
// прямо в браузер, хук постит его на /api/auth/google/one-tap и отдаёт сессию
// наверх (или уводит на второй фактор). CLIENT_ID/API_BASE читаются из
// import.meta.env один раз при импорте модуля — поэтому каждый тест сбрасывает
// кэш и переимпортирует хук со своим окружением (образец — api.env.test.ts).
import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';

interface GoogleIdMock {
  initialize: ReturnType<typeof vi.fn>;
  prompt: ReturnType<typeof vi.fn>;
  cancel: ReturnType<typeof vi.fn>;
}

function installGoogle(): GoogleIdMock {
  const id: GoogleIdMock = {
    initialize: vi.fn(),
    prompt: vi.fn(),
    cancel: vi.fn(),
  };
  (window as unknown as { google: unknown }).google = { accounts: { id } };
  return id;
}

// Колбэк, который хук отдал Google в initialize({ callback }).
function capturedCallback(
  id: GoogleIdMock,
): (r: { credential?: string }) => void {
  return id.initialize.mock.calls[0][0].callback;
}

function okJson(body: unknown): Response {
  return {
    ok: true,
    json: () => Promise.resolve(body),
  } as unknown as Response;
}

const NOOP = (): void => {};

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.resetModules();
  delete (window as unknown as { google?: unknown }).google;
});

describe('useGoogleOneTap', () => {
  it('enabled + client_id: initialize с client_id и колбэком, затем prompt', async () => {
    vi.stubEnv('VITE_GOOGLE_CLIENT_ID', 'client-123');
    const id = installGoogle();
    const { useGoogleOneTap } = await import('./useGoogleOneTap');

    renderHook(() =>
      useGoogleOneTap({ enabled: true, onSession: NOOP, onTwofa: NOOP }),
    );

    expect(id.initialize).toHaveBeenCalledTimes(1);
    const cfg = id.initialize.mock.calls[0][0];
    expect(cfg.client_id).toBe('client-123');
    expect(typeof cfg.callback).toBe('function');
    expect(id.prompt).toHaveBeenCalledTimes(1);
  });

  it('колбэк постит credential на /api/auth/google/one-tap → onSession(access, expiresIn)', async () => {
    vi.stubEnv('VITE_GOOGLE_CLIENT_ID', 'client-123');
    const fetchMock = vi
      .fn()
      .mockResolvedValue(okJson({ accessToken: 'a', expiresIn: 900 }));
    vi.stubGlobal('fetch', fetchMock);
    const id = installGoogle();
    const onSession = vi.fn();
    const { useGoogleOneTap } = await import('./useGoogleOneTap');

    renderHook(() =>
      useGoogleOneTap({ enabled: true, onSession, onTwofa: NOOP }),
    );
    capturedCallback(id)({ credential: 'x.y.z' });

    await vi.waitFor(() => expect(onSession).toHaveBeenCalledWith('a', 900));
    expect(String(fetchMock.mock.calls[0][0])).toBe('/api/auth/google/one-tap');
    const init = fetchMock.mock.calls[0][1];
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual({ credential: 'x.y.z' });
  });

  it('ответ { twofa, challengeToken } уводит на второй фактор через onTwofa', async () => {
    vi.stubEnv('VITE_GOOGLE_CLIENT_ID', 'client-123');
    const fetchMock = vi
      .fn()
      .mockResolvedValue(okJson({ twofa: true, challengeToken: 'ct' }));
    vi.stubGlobal('fetch', fetchMock);
    const id = installGoogle();
    const onTwofa = vi.fn();
    const { useGoogleOneTap } = await import('./useGoogleOneTap');

    renderHook(() =>
      useGoogleOneTap({ enabled: true, onSession: NOOP, onTwofa }),
    );
    capturedCallback(id)({ credential: 'x.y.z' });

    await vi.waitFor(() => expect(onTwofa).toHaveBeenCalledWith('ct'));
  });

  it('без VITE_GOOGLE_CLIENT_ID: ни initialize, ни prompt — остаются обычные кнопки', async () => {
    vi.stubEnv('VITE_GOOGLE_CLIENT_ID', '');
    const id = installGoogle();
    const { useGoogleOneTap } = await import('./useGoogleOneTap');

    renderHook(() =>
      useGoogleOneTap({ enabled: true, onSession: NOOP, onTwofa: NOOP }),
    );

    expect(id.initialize).not.toHaveBeenCalled();
    expect(id.prompt).not.toHaveBeenCalled();
  });

  it('сеть легла при отправке credential → onError, без onSession/onTwofa', async () => {
    vi.stubEnv('VITE_GOOGLE_CLIENT_ID', 'client-123');
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new Error('network down')),
    );
    const id = installGoogle();
    const onError = vi.fn();
    const onSession = vi.fn();
    const onTwofa = vi.fn();
    const { useGoogleOneTap } = await import('./useGoogleOneTap');

    renderHook(() =>
      useGoogleOneTap({ enabled: true, onSession, onTwofa, onError }),
    );
    capturedCallback(id)({ credential: 'x.y.z' });

    // Сбой отправки виден в телеметрии, но не как экран-тупик (правило №14):
    // onError вызван, входа нет, кнопки ниже остаются рабочими.
    await vi.waitFor(() =>
      expect(onError).toHaveBeenCalledWith({
        message: 'one-tap submit failed',
        section: 'login.one-tap',
      }),
    );
    expect(onSession).not.toHaveBeenCalled();
    expect(onTwofa).not.toHaveBeenCalled();
  });

  it('сервер ответил не-2xx → ни onSession, ни onTwofa (кнопки остаются)', async () => {
    vi.stubEnv('VITE_GOOGLE_CLIENT_ID', 'client-123');
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({}),
    } as unknown as Response);
    vi.stubGlobal('fetch', fetchMock);
    const id = installGoogle();
    const onSession = vi.fn();
    const onTwofa = vi.fn();
    const { useGoogleOneTap } = await import('./useGoogleOneTap');

    renderHook(() => useGoogleOneTap({ enabled: true, onSession, onTwofa }));
    capturedCallback(id)({ credential: 'x.y.z' });

    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(onSession).not.toHaveBeenCalled();
    expect(onTwofa).not.toHaveBeenCalled();
  });

  it('скрипт GIS ещё не загрузился → опрос, после появления window.google — initialize', async () => {
    vi.useFakeTimers();
    vi.stubEnv('VITE_GOOGLE_CLIENT_ID', 'client-123');
    // window.google пока нет — хук должен запланировать повторную попытку.
    const { useGoogleOneTap } = await import('./useGoogleOneTap');

    renderHook(() =>
      useGoogleOneTap({ enabled: true, onSession: NOOP, onTwofa: NOOP }),
    );
    // Скрипт догрузился между попытками.
    const id = installGoogle();
    await vi.advanceTimersByTimeAsync(100);

    expect(id.initialize).toHaveBeenCalledTimes(1);
    expect(id.prompt).toHaveBeenCalledTimes(1);
  });

  it('размонтирование экрана входа → id.cancel(), всплывашка снимается', async () => {
    vi.stubEnv('VITE_GOOGLE_CLIENT_ID', 'client-123');
    const id = installGoogle();
    const { useGoogleOneTap } = await import('./useGoogleOneTap');

    const { unmount } = renderHook(() =>
      useGoogleOneTap({ enabled: true, onSession: NOOP, onTwofa: NOOP }),
    );
    unmount();

    expect(id.cancel).toHaveBeenCalledTimes(1);
  });
});
