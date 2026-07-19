// @vitest-environment jsdom
// Тесты HTTP-слоя webapp (api.ts) — TEST_COVERAGE_PLAN этап 2 п.10.
//
// ВАЖНО: в api.ts НЕТ логики refresh/retry при 401. Обновление access-токена
// живёт отдельно, в src/auth/AuthContext.tsx (doRefresh по таймеру, за 60с до
// истечения expiresIn) — api.ts просто использует то, что вернёт
// setTokenProvider(), и при 401 бросает обычный Error, без похода на
// /api/auth/refresh и без повторного запроса. Тесты ниже фиксируют это
// РЕАЛЬНОЕ поведение, а не предполагаемый interceptor-паттерн.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { api, setTokenProvider } from './api';

function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  } as unknown as Response;
}

function brokenJsonResponse(status: number): Response {
  return {
    ok: false,
    status,
    json: () => Promise.reject(new Error('not json')),
  } as unknown as Response;
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
  setTokenProvider(() => null);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

// ── Заголовки авторизации и сериализация запроса ────────────────────────────
describe('authHeaders — формат заголовка авторизации', () => {
  it('при наличии токена шлёт "Authorization: Bearer <token>" и Content-Type json', async () => {
    setTokenProvider(() => 'abc123');
    fetchMock.mockResolvedValue(jsonResponse(200, {}));

    await api.getSettings();

    const [, init] = fetchMock.mock.calls[0];
    expect(init.headers.Authorization).toBe('Bearer abc123');
    expect(init.headers['Content-Type']).toBe('application/json');
  });

  it('без токена (провайдер вернул null) заголовок Authorization отсутствует', async () => {
    setTokenProvider(() => null);
    fetchMock.mockResolvedValue(jsonResponse(200, {}));

    await api.getSettings();

    const [, init] = fetchMock.mock.calls[0];
    expect(init.headers.Authorization).toBeUndefined();
  });

  it('токен читается заново на каждый запрос (не кэшируется в module-level переменной)', async () => {
    let current = 'first';
    setTokenProvider(() => current);
    fetchMock.mockResolvedValue(jsonResponse(200, {}));

    await api.getSettings();
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe('Bearer first');

    current = 'second';
    await api.getSettings();
    expect(fetchMock.mock.calls[1][1].headers.Authorization).toBe('Bearer second');
  });
});

describe('запросы всегда идут с credentials: "include"', () => {
  it('GET (get<T>)', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, {}));
    await api.getSettings();
    expect(fetchMock.mock.calls[0][1].credentials).toBe('include');
  });

  it('POST через postJson', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { ok: true }));
    await api.updateName('Имя');
    expect(fetchMock.mock.calls[0][1].credentials).toBe('include');
  });

  it('PATCH через patchJson', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, {}));
    await api.updateModeMap(1, { title: 'x' });
    expect(fetchMock.mock.calls[0][1].credentials).toBe('include');
  });

  it('DELETE (del)', async () => {
    fetchMock.mockResolvedValue(jsonResponse(204, undefined));
    await api.deletePractice(1);
    expect(fetchMock.mock.calls[0][1].credentials).toBe('include');
  });

  it('ручные fetch-вызовы (saveRating, createPairInvite, leavePair) тоже включают credentials', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { ok: true, allDone: false }));
    await api.saveRating('safety', 5);
    expect(fetchMock.mock.calls[0][1].credentials).toBe('include');
  });
});

// ── 401 ──────────────────────────────────────────────────────────────────────
describe('401 Unauthorized', () => {
  it('get<T>: бросает Error("API error: 401"), НЕ обращается к /api/auth/refresh, НЕ ретраит', async () => {
    fetchMock.mockResolvedValue(jsonResponse(401, { message: 'Unauthorized' }));

    await expect(api.getSettings()).rejects.toThrow('API error: 401');

    // Один вызов на исходный запрос — ни ретрая, ни рефреша.
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url] = fetchMock.mock.calls[0];
    expect(String(url)).not.toContain('/api/auth/refresh');
  });

  it('postJson: 401 тоже даёт единственный запрос и пробрасывает сообщение из тела ответа', async () => {
    fetchMock.mockResolvedValue(jsonResponse(401, { message: 'Unauthorized' }));

    await expect(api.updateName('x')).rejects.toThrow('Unauthorized');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('нет single-flight: два параллельных запроса на 401 бьются независимо, каждый уходит в сеть отдельно', async () => {
    fetchMock.mockResolvedValue(jsonResponse(401, {}));

    const [r1, r2] = await Promise.allSettled([api.getSettings(), api.getAchievements()]);

    expect(r1.status).toBe('rejected');
    expect(r2.status).toBe('rejected');
    // Не объединены в один поход за токеном — оба реально дошли до fetch.
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('валидный токен: успешный запрос не обращается к /api/auth/refresh', async () => {
    setTokenProvider(() => 'valid-token');
    fetchMock.mockResolvedValue(jsonResponse(200, {}));

    await api.getSettings();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).not.toContain('/api/auth/refresh');
  });
});

// ── Проброс не-401 ошибок ────────────────────────────────────────────────────
describe('проброс ошибок для не-401 статусов', () => {
  it('get<T>: любой !ok статус даёт "API error: <status>" (тело ответа не парсится)', async () => {
    const res = brokenJsonResponse(500); // res.json() всегда падает — get не должен его дёргать
    fetchMock.mockResolvedValue(res);

    await expect(api.getSettings()).rejects.toThrow('API error: 500');
  });

  it('del: любой !ok статус даёт "API error: <status>" без парсинга тела', async () => {
    fetchMock.mockResolvedValue(brokenJsonResponse(403));
    await expect(api.deletePractice(1)).rejects.toThrow('API error: 403');
  });

  it('postJson: при строковом message из тела бросает именно это сообщение', async () => {
    fetchMock.mockResolvedValue(jsonResponse(400, { message: 'Имя обязательно' }));
    await expect(api.updateName('')).rejects.toThrow('Имя обязательно');
  });

  it('postJson: при message-массиве (class-validator) сериализует в JSON-строку', async () => {
    fetchMock.mockResolvedValue(jsonResponse(400, { message: ['поле a обязательно', 'поле b обязательно'] }));
    await expect(api.updateName('')).rejects.toThrow(JSON.stringify(['поле a обязательно', 'поле b обязательно']));
  });

  it('postJson: если тело не парсится как JSON — падает обратно на "API error: <status>"', async () => {
    fetchMock.mockResolvedValue(brokenJsonResponse(502));
    await expect(api.updateName('x')).rejects.toThrow('API error: 502');
  });

  it('patchJson: сообщение об ошибке из тела пробрасывается так же, как в postJson', async () => {
    fetchMock.mockResolvedValue(jsonResponse(409, { message: 'Конфликт версий' }));
    await expect(api.updateModeMap(1, { title: 'x' })).rejects.toThrow('Конфликт версий');
  });
});

// ── Успешные ответы ──────────────────────────────────────────────────────────
describe('успешные ответы', () => {
  it('get<T> возвращает распарсенный JSON как есть', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { notifyEnabled: true, pairCardDismissed: false }));
    const settings = await api.getSettings();
    expect(settings).toEqual({ notifyEnabled: true, pairCardDismissed: false });
  });

  it('del (deletePractice) резолвится без чтения тела при 204', async () => {
    const res = jsonResponse(204, undefined);
    const jsonSpy = vi.spyOn(res, 'json');
    fetchMock.mockResolvedValue(res);

    await expect(api.deletePractice(1)).resolves.toBeUndefined();
    expect(jsonSpy).not.toHaveBeenCalled();
  });
});

// ── Админский путь: другая схема заголовков ─────────────────────────────────
describe('adminReq — заголовки не используют Bearer-токен', () => {
  it('шлёт x-admin-key вместо Authorization, даже если задан tokenProvider', async () => {
    setTokenProvider(() => 'user-jwt-should-be-ignored');
    fetchMock.mockResolvedValue(jsonResponse(200, {}));

    await api.adminStatus('secret-admin-key');

    const [, init] = fetchMock.mock.calls[0];
    expect(init.headers['x-admin-key']).toBe('secret-admin-key');
    expect(init.headers.Authorization).toBeUndefined();
  });

  it('204 без тела резолвится в undefined без вызова json()', async () => {
    const res = jsonResponse(204, undefined);
    const jsonSpy = vi.spyOn(res, 'json');
    fetchMock.mockResolvedValue(res);

    await expect(api.adminDeleteRule('key', 1)).resolves.toBeUndefined();
    expect(jsonSpy).not.toHaveBeenCalled();
  });

  it('GET без тела не добавляет body в init', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, []));
    await api.adminGetPrices('key');
    expect(fetchMock.mock.calls[0][1].body).toBeUndefined();
  });
});

// ── Таймаут запроса (fetchWithTimeout) ──────────────────────────────────────
describe('fetchWithTimeout — отмена по таймауту', () => {
  it('через 15с без ответа сигнал AbortController помечается aborted', () => {
    vi.useFakeTimers();
    let capturedSignal: AbortSignal | undefined;
    fetchMock.mockImplementation((_url: string, init: RequestInit) => {
      capturedSignal = init.signal ?? undefined;
      return new Promise(() => {}); // никогда не резолвится — имитация зависшей сети
    });

    // Не ждём результат — промис намеренно повиснет из-за мока выше.
    void api.getSettings().catch(() => {});

    expect(capturedSignal?.aborted).toBe(false);
    vi.advanceTimersByTime(15000);
    expect(capturedSignal?.aborted).toBe(true);

    vi.useRealTimers();
  });
});
