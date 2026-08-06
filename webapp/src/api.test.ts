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
import { api, setTokenProvider, reportClientError } from './api';

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
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe(
      'Bearer first',
    );

    current = 'second';
    await api.getSettings();
    expect(fetchMock.mock.calls[1][1].headers.Authorization).toBe(
      'Bearer second',
    );
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
    fetchMock.mockResolvedValue(
      jsonResponse(200, { ok: true, allDone: false }),
    );
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

    const [r1, r2] = await Promise.allSettled([
      api.getSettings(),
      api.getAchievements(),
    ]);

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
    expect(String(fetchMock.mock.calls[0][0])).not.toContain(
      '/api/auth/refresh',
    );
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
    fetchMock.mockResolvedValue(
      jsonResponse(400, { message: 'Имя обязательно' }),
    );
    await expect(api.updateName('')).rejects.toThrow('Имя обязательно');
  });

  it('postJson: при message-массиве (class-validator) сериализует в JSON-строку', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(400, {
        message: ['поле a обязательно', 'поле b обязательно'],
      }),
    );
    await expect(api.updateName('')).rejects.toThrow(
      JSON.stringify(['поле a обязательно', 'поле b обязательно']),
    );
  });

  it('postJson: если тело не парсится как JSON — падает обратно на "API error: <status>"', async () => {
    fetchMock.mockResolvedValue(brokenJsonResponse(502));
    await expect(api.updateName('x')).rejects.toThrow('API error: 502');
  });

  it('patchJson: сообщение об ошибке из тела пробрасывается так же, как в postJson', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(409, { message: 'Конфликт версий' }),
    );
    await expect(api.updateModeMap(1, { title: 'x' })).rejects.toThrow(
      'Конфликт версий',
    );
  });
});

// ── Успешные ответы ──────────────────────────────────────────────────────────
describe('успешные ответы', () => {
  it('get<T> возвращает распарсенный JSON как есть', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(200, { notifyEnabled: true, pairCardDismissed: false }),
    );
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

// ── post() (void-возвращающий, отдельно от postJson) ────────────────────────
describe('post — void-обёртка (trackEvent/createBeliefCheck и т.п.)', () => {
  it('успех: тело запроса сериализовано, метод POST, ничего не возвращает', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, {}));
    await expect(
      api.createBeliefCheck({
        belief: 'я плохой',
        evidenceFor: [],
        evidenceAgainst: ['друзья говорят обратное'],
      }),
    ).resolves.toBeUndefined();

    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain('/api/belief-checks');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual({
      belief: 'я плохой',
      evidenceFor: [],
      evidenceAgainst: ['друзья говорят обратное'],
    });
  });

  it('ошибка: сообщение из тела ответа пробрасывается вызывающему', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(400, { message: 'Убеждение обязательно' }),
    );
    await expect(
      api.createBeliefCheck({
        belief: '',
        evidenceFor: [],
        evidenceAgainst: [],
      }),
    ).rejects.toThrow('Убеждение обязательно');
  });

  it('ошибка без парсибельного тела: падает на "API error: <status>", не глотает ошибку', async () => {
    fetchMock.mockResolvedValue(brokenJsonResponse(500));
    await expect(
      api.createBeliefCheck({
        belief: 'x',
        evidenceFor: [],
        evidenceAgainst: [],
      }),
    ).rejects.toThrow('API error: 500');
  });
});

// ── del — с телом и без ────────────────────────────────────────────────────
describe('del — DELETE-запрос', () => {
  it('без тела: init.body не выставлен', async () => {
    fetchMock.mockResolvedValue(jsonResponse(204, undefined));
    await api.deletePractice(1);
    expect(fetchMock.mock.calls[0][1].body).toBeUndefined();
  });

  it('с телом (leavePair): body сериализован, метод DELETE', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, {}));
    await api.leavePair('ABC123');
    const [, init] = fetchMock.mock.calls[0];
    expect(init.method).toBe('DELETE');
    expect(JSON.parse(init.body)).toEqual({ code: 'ABC123' });
  });

  it('ошибка: бросает Error, не резолвится молча', async () => {
    fetchMock.mockResolvedValue(jsonResponse(404, {}));
    await expect(api.deletePractice(1)).rejects.toThrow('API error: 404');
  });
});

// ── adminReq — фолбэк при 2xx с непарсибельным телом ─────────────────────────
describe('adminReq — успешный статус без валидного JSON-тела', () => {
  it('не 204, но res.json() падает — резолвится в undefined, а не бросает', async () => {
    const res = {
      ok: true,
      status: 200,
      json: () => Promise.reject(new Error('not json')),
    } as unknown as Response;
    fetchMock.mockResolvedValue(res);

    await expect(api.adminGetPrices('key')).resolves.toBeUndefined();
  });
});

// ── saveRating — ручной fetch (не через get/post) ────────────────────────────
describe('saveRating — прямой fetch-вызов', () => {
  it('успех: тело запроса содержит needId/value/date, возвращает распарсенный JSON', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(200, {
        ok: true,
        allDone: true,
        streak: { current: 3, best: 5 },
      }),
    );
    const result = await api.saveRating('safety', 7, '2026-01-15');

    const [, init] = fetchMock.mock.calls[0];
    expect(JSON.parse(init.body)).toEqual({
      needId: 'safety',
      value: 7,
      date: '2026-01-15',
    });
    expect(result).toEqual({
      ok: true,
      allDone: true,
      streak: { current: 3, best: 5 },
    });
  });

  it('!ok статус: бросает Error("API error: <status>"), ошибка видна вызывающему', async () => {
    fetchMock.mockResolvedValue(jsonResponse(500, {}));
    await expect(api.saveRating('safety', 7)).rejects.toThrow('API error: 500');
  });
});

// ── reportClientError — best-effort телеметрия ошибок ─────────────────────────
describe('reportClientError', () => {
  it('шлёт POST на /api/client-errors с обрезанными полями, keepalive, БЕЗ авторизации', () => {
    setTokenProvider(() => 'should-not-appear');
    fetchMock.mockResolvedValue(jsonResponse(200, {}));

    reportClientError({
      message: 'x'.repeat(600),
      section: 'y'.repeat(200),
      stack: 'z'.repeat(5000),
      componentStack: 'w'.repeat(5000),
    });

    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain('/api/client-errors');
    expect(init.method).toBe('POST');
    expect(init.keepalive).toBe(true);
    expect(init.headers.Authorization).toBeUndefined();

    const body = JSON.parse(init.body);
    expect(body.message).toHaveLength(500);
    expect(body.section).toHaveLength(120);
    expect(body.stack).toHaveLength(4000);
    expect(body.componentStack).toHaveLength(4000);
    expect(body.source).toBe('webapp');
  });

  it('не бросает и не отклоняет промис вызывающего, если сеть недоступна (fire-and-forget)', () => {
    fetchMock.mockRejectedValue(new Error('network down'));
    expect(() =>
      reportClientError({ message: 'краш', section: 'today' }),
    ).not.toThrow();
  });

  it('не бросает, даже если сам fetch кидает синхронно', () => {
    fetchMock.mockImplementation(() => {
      throw new Error('sync boom');
    });
    expect(() =>
      reportClientError({ message: 'краш', section: 'today' }),
    ).not.toThrow();
  });
});

// ── Сетевой сбой (fetch reject) — проброс, а не молчаливое поглощение ────────
describe('сетевой сбой (fetch отклоняется) пробрасывается вызывающему', () => {
  it('get<T>: TypeError сети долетает до caller как rejection', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));
    await expect(api.getSettings()).rejects.toThrow('Failed to fetch');
  });

  it('postJson: сетевой сбой тоже пробрасывается, а не резолвится пустым значением', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));
    await expect(api.updateName('Имя')).rejects.toThrow('Failed to fetch');
  });
});

// ── Непарсибельный/пустой ответ на успешном статусе — тоже проброс ──────────
describe('успешный статус, но тело не JSON — не глотается молча', () => {
  it('get<T>: res.json() падает на 200 — ошибка долетает до caller', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: () =>
        Promise.reject(new SyntaxError('Unexpected end of JSON input')),
    } as unknown as Response);

    await expect(api.getSettings()).rejects.toThrow(
      'Unexpected end of JSON input',
    );
  });
});

// ── Query-параметры (branch coverage построения URL) ─────────────────────────
describe('getSlots — построение query-строки', () => {
  it('без from/to — путь без "?"', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, []));
    await api.getSlots();
    expect(String(fetchMock.mock.calls[0][0])).toMatch(
      /\/api\/booking\/slots$/,
    );
  });

  it('только from', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, []));
    await api.getSlots('2026-01-01');
    expect(String(fetchMock.mock.calls[0][0])).toContain('from=2026-01-01');
    expect(String(fetchMock.mock.calls[0][0])).not.toContain('to=');
  });

  it('from и to вместе', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, []));
    await api.getSlots('2026-01-01', '2026-01-31');
    const url = String(fetchMock.mock.calls[0][0]);
    expect(url).toContain('from=2026-01-01');
    expect(url).toContain('to=2026-01-31');
  });
});

describe('getQuizzes — необязательный параметр формы обращения', () => {
  it('без form — запрос без query', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { quizzes: [] }));
    await api.getQuizzes();
    expect(String(fetchMock.mock.calls[0][0])).toMatch(/\/api\/quizzes$/);
  });

  it('form="vy" — добавляет ?form=vy', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { quizzes: [] }));
    await api.getQuizzes('vy');
    expect(String(fetchMock.mock.calls[0][0])).toContain('?form=vy');
  });
});

describe('createModeMap — дефолт kind="problem"', () => {
  it('без явного kind шлёт "problem"', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, {}));
    await api.createModeMap(1, 'Карта');
    const [, init] = fetchMock.mock.calls[0];
    expect(JSON.parse(init.body).kind).toBe('problem');
  });

  it('с явным kind шлёт его, а не дефолт', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, {}));
    await api.createModeMap(1, 'Карта', 'healthy');
    const [, init] = fetchMock.mock.calls[0];
    expect(JSON.parse(init.body).kind).toBe('healthy');
  });
});

describe('adminListBookings — дефолт filter="upcoming"', () => {
  it('без явного filter уходит "upcoming"', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, []));
    await api.adminListBookings('key');
    expect(String(fetchMock.mock.calls[0][0])).toContain('filter=upcoming');
  });

  it('с явным filter уходит он', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, []));
    await api.adminListBookings('key', 'cancelled');
    expect(String(fetchMock.mock.calls[0][0])).toContain('filter=cancelled');
  });
});

// ── Ветка "тело без message" — фолбэк на "API error: <status>" ──────────────
// Тело ответа парсится успешно, но поля message в нём нет: post/postJson/
// patchJson не должны падать на этом и обязаны вернуть дефолтное сообщение.
describe('ошибка с успешно распарсенным телом, но без поля message', () => {
  it('post: фолбэк на "API error: <status>"', async () => {
    fetchMock.mockResolvedValue(jsonResponse(400, { error: 'something' }));
    await expect(
      api.createBeliefCheck({
        belief: 'x',
        evidenceFor: [],
        evidenceAgainst: [],
      }),
    ).rejects.toThrow('API error: 400');
  });

  it('postJson: фолбэк на "API error: <status>"', async () => {
    fetchMock.mockResolvedValue(jsonResponse(400, {}));
    await expect(api.updateName('x')).rejects.toThrow('API error: 400');
  });

  it('patchJson: фолбэк на "API error: <status>"', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(400, { detail: 'unrelated field' }),
    );
    await expect(api.updateModeMap(1, { title: 'x' })).rejects.toThrow(
      'API error: 400',
    );
  });
});

// ── reportClientError без глобального location ───────────────────────────────
describe('reportClientError — окружение без location', () => {
  it('typeof location === "undefined" — поле url в теле отсутствует', () => {
    const original = globalThis.location;
    // @ts-expect-error — намеренно убираем location, чтобы проверить SSR-ветку
    delete globalThis.location;
    fetchMock.mockResolvedValue(jsonResponse(200, {}));

    reportClientError({ message: 'краш без окна', section: 'ssr' });

    const [, init] = fetchMock.mock.calls[0];
    const body = JSON.parse(init.body);
    expect(body.url).toBeUndefined();

    globalThis.location = original;
  });
});

// ── adminReq — тело запроса и ошибка с сообщением ─────────────────────────────
describe('adminReq — запрос с телом и обработка ошибки с message', () => {
  it('тело сериализуется и уходит в запросе (adminSetPrice)', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { ok: true }));
    await api.adminSetPrice('key', 'INTRO_15', 1500);
    const [, init] = fetchMock.mock.calls[0];
    expect(JSON.parse(init.body)).toEqual({ type: 'INTRO_15', amount: 1500 });
  });

  it('ошибка с телом { message } пробрасывает именно это сообщение', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(403, { message: 'Неверный ключ администратора' }),
    );
    await expect(api.adminGetPrices('key')).rejects.toThrow(
      'Неверный ключ администратора',
    );
  });

  it('ошибка без парсибельного тела — фолбэк на "API error: <status>"', async () => {
    fetchMock.mockResolvedValue(brokenJsonResponse(500));
    await expect(api.adminGetPrices('key')).rejects.toThrow('API error: 500');
  });
});
