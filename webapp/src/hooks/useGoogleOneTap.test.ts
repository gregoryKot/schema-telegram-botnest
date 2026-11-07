// @vitest-environment jsdom
// useGoogleOneTap — необязательный путь входа: всплывашка Google отдаёт id_token
// прямо в браузер, хук постит его на /api/auth/google/one-tap и отдаёт сессию
// наверх (или уводит на второй фактор). CLIENT_ID/API_BASE читаются из
// import.meta.env один раз при импорте модуля — поэтому каждый тест сбрасывает
// кэш и переимпортирует хук со своим окружением (образец — api.env.test.ts).
// Скрипт Google хук грузит сам (gsiScript.ts): в jsdom внешние скрипты не
// грузятся, поэтому событие load на теге тест шлёт руками.
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

// fetch-двойник: GET nonce всегда отвечает хешем, POST credential — как задано.
const NONCE = 'a'.repeat(64);
function fetchRouter(post: () => Promise<Response>) {
  return vi.fn((url: string) =>
    String(url).endsWith('/api/auth/google/one-tap/nonce')
      ? Promise.resolve(okJson({ nonce: NONCE }))
      : post(),
  );
}
const postCall = (fm: ReturnType<typeof fetchRouter>) =>
  fm.mock.calls.find(
    (c) => !String(c[0]).endsWith('/nonce'),
  ) as unknown as [string, RequestInit & { body: string }];
const initialized = (id: GoogleIdMock) =>
  vi.waitFor(() => expect(id.initialize).toHaveBeenCalledTimes(1));
const gsiTag = () => document.head.querySelector('script#gsi-client');

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.resetModules();
  delete (window as unknown as { google?: unknown }).google;
  document.head
    .querySelectorAll('script#gsi-client')
    .forEach((n) => n.remove());
});

describe('useGoogleOneTap', () => {
  it('enabled + client_id: initialize с client_id и колбэком, затем prompt', async () => {
    vi.stubEnv('VITE_GOOGLE_CLIENT_ID', 'client-123');
    vi.stubGlobal('fetch', fetchRouter(() => Promise.resolve(okJson({}))));
    const id = installGoogle();
    const { useGoogleOneTap } = await import('./useGoogleOneTap');

    renderHook(() =>
      useGoogleOneTap({ enabled: true, onSession: NOOP, onTwofa: NOOP }),
    );

    await initialized(id);
    const cfg = id.initialize.mock.calls[0][0];
    expect(cfg.client_id).toBe('client-123');
    // B-16: хеш из /nonce уходит в GIS — Google вписывает его в id_token.
    expect(cfg.nonce).toBe(NONCE);
    expect(typeof cfg.callback).toBe('function');
    expect(id.prompt).toHaveBeenCalledTimes(1);
    // Скрипт Google уже на странице — второй тег не нужен.
    expect(gsiTag()).toBeNull();
  });

  it('колбэк постит credential на /api/auth/google/one-tap → onSession(access, expiresIn)', async () => {
    vi.stubEnv('VITE_GOOGLE_CLIENT_ID', 'client-123');
    const fetchMock = fetchRouter(() =>
      Promise.resolve(okJson({ accessToken: 'a', expiresIn: 900 })),
    );
    vi.stubGlobal('fetch', fetchMock);
    const id = installGoogle();
    const onSession = vi.fn();
    const { useGoogleOneTap } = await import('./useGoogleOneTap');

    renderHook(() =>
      useGoogleOneTap({ enabled: true, onSession, onTwofa: NOOP }),
    );
    await initialized(id);
    capturedCallback(id)({ credential: 'x.y.z' });

    await vi.waitFor(() => expect(onSession).toHaveBeenCalledWith('a', 900));
    // Сначала nonce (с куками), потом credential.
    expect(String(fetchMock.mock.calls[0][0])).toBe(
      '/api/auth/google/one-tap/nonce',
    );
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ credentials: 'include' });
    expect(String(postCall(fetchMock)[0])).toBe('/api/auth/google/one-tap');
    const init = postCall(fetchMock)[1];
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual({ credential: 'x.y.z' });
  });

  it('ответ { twofa, challengeToken } уводит на второй фактор через onTwofa', async () => {
    vi.stubEnv('VITE_GOOGLE_CLIENT_ID', 'client-123');
    const fetchMock = fetchRouter(() =>
      Promise.resolve(okJson({ twofa: true, challengeToken: 'ct' })),
    );
    vi.stubGlobal('fetch', fetchMock);
    const id = installGoogle();
    const onTwofa = vi.fn();
    const { useGoogleOneTap } = await import('./useGoogleOneTap');

    renderHook(() =>
      useGoogleOneTap({ enabled: true, onSession: NOOP, onTwofa }),
    );
    await initialized(id);
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

  it('без VITE_GOOGLE_CLIENT_ID и без window.google → тег Google не вставляется', async () => {
    vi.stubEnv('VITE_GOOGLE_CLIENT_ID', '');
    const { useGoogleOneTap } = await import('./useGoogleOneTap');

    renderHook(() =>
      useGoogleOneTap({ enabled: true, onSession: NOOP, onTwofa: NOOP }),
    );

    // Окно выключено сборкой — к Google вообще не ходим.
    expect(gsiTag()).toBeNull();
  });

  it('enabled: false → тег Google не вставляется (скрипта нет, к Google не ходим)', async () => {
    vi.stubEnv('VITE_GOOGLE_CLIENT_ID', 'client-123');
    const { useGoogleOneTap } = await import('./useGoogleOneTap');

    renderHook(() =>
      useGoogleOneTap({ enabled: false, onSession: NOOP, onTwofa: NOOP }),
    );

    expect(gsiTag()).toBeNull();
  });

  // Сбой отправки виден в телеметрии, но не как экран-тупик (правило №14): onError
  // вызван, входа нет, кнопки ниже остаются рабочими. Отказ сервера (например,
  // client id сборки разошёлся с бэкендом) приходит с кодом ответа.
  it.each([
    ['сеть легла', () => Promise.reject(new Error('network down')), 'one-tap submit failed'],
    [
      'сервер ответил 401',
      () => Promise.resolve({ ok: false, status: 401, json: () => Promise.resolve({}) } as unknown as Response),
      'one-tap rejected 401',
    ],
  ] as const)('%s при отправке credential → onError, без onSession/onTwofa', async (_case, post, message) => {
    vi.stubEnv('VITE_GOOGLE_CLIENT_ID', 'client-123');
    vi.stubGlobal('fetch', fetchRouter(post));
    const id = installGoogle();
    const onError = vi.fn();
    const onSession = vi.fn();
    const onTwofa = vi.fn();
    const { useGoogleOneTap } = await import('./useGoogleOneTap');

    renderHook(() =>
      useGoogleOneTap({ enabled: true, onSession, onTwofa, onError }),
    );
    await initialized(id);
    capturedCallback(id)({ credential: 'x.y.z' });

    await vi.waitFor(() =>
      expect(onError).toHaveBeenCalledWith({ message, section: 'login.one-tap' }),
    );
    expect(onSession).not.toHaveBeenCalled();
    expect(onTwofa).not.toHaveBeenCalled();
  });

  it('window.google нет → хук вставил script#gsi-client; после load — initialize', async () => {
    vi.stubEnv('VITE_GOOGLE_CLIENT_ID', 'client-123');
    vi.stubGlobal('fetch', fetchRouter(() => Promise.resolve(okJson({}))));
    // window.google пока нет — хук сам подключает скрипт Google.
    const { useGoogleOneTap } = await import('./useGoogleOneTap');

    renderHook(() =>
      useGoogleOneTap({ enabled: true, onSession: NOOP, onTwofa: NOOP }),
    );

    const tag = gsiTag();
    expect(tag).not.toBeNull();
    expect(tag?.getAttribute('src')).toBe(
      'https://accounts.google.com/gsi/client',
    );
    // Скрипт догрузился: появился window.google и пришло событие load.
    const id = installGoogle();
    tag?.dispatchEvent(new Event('load'));

    await initialized(id);
    expect(id.prompt).toHaveBeenCalledTimes(1);
  });

  it('скрипт Google не загрузился (error) → всплывашка не показывается, без ошибок', async () => {
    vi.stubEnv('VITE_GOOGLE_CLIENT_ID', 'client-123');
    const fetchMock = fetchRouter(() => Promise.resolve(okJson({})));
    vi.stubGlobal('fetch', fetchMock);
    const onError = vi.fn();
    const { useGoogleOneTap } = await import('./useGoogleOneTap');

    renderHook(() =>
      useGoogleOneTap({
        enabled: true,
        onSession: NOOP,
        onTwofa: NOOP,
        onError,
      }),
    );
    gsiTag()?.dispatchEvent(new Event('error'));
    await vi.waitFor(() => expect(gsiTag()).toBeNull());
    await Promise.resolve();

    // Даже nonce не запрашиваем: показывать нечем, кнопки входа остаются.
    expect(fetchMock).not.toHaveBeenCalled();
    expect(onError).not.toHaveBeenCalled();
  });

  it('nonce не получен (сервер/сеть) → всплывашка не показывается: без nonce сервер токен всё равно отклонит', async () => {
    vi.stubEnv('VITE_GOOGLE_CLIENT_ID', 'client-123');
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({}),
    } as unknown as Response);
    vi.stubGlobal('fetch', fetchMock);
    const id = installGoogle();
    const { useGoogleOneTap } = await import('./useGoogleOneTap');

    renderHook(() =>
      useGoogleOneTap({ enabled: true, onSession: NOOP, onTwofa: NOOP }),
    );
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    await Promise.resolve();

    expect(id.initialize).not.toHaveBeenCalled();
    expect(id.prompt).not.toHaveBeenCalled();
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
