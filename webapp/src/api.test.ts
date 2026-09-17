// @vitest-environment jsdom
// Тесты HTTP-слоя webapp (api.ts) — TEST_COVERAGE_PLAN этап 2 п.10.
//
// Сетевая инфраструктура (get/post/authedFetch/401-retry) переехала в
// apiClient.ts (правило №10 — api.ts не имеет права расти сверх бейслайна;
// правило №3 — зеркало schema-miniapp/src/apiClient.ts). api.ts зовёт
// setRefreshHandler() только через TokenBridge (App.tsx) в реальном
// приложении — по умолчанию, пока его никто не вызвал, _refresh === null и
// 401 ведёт себя как раньше: единственный запрос, без похода на
// /api/auth/refresh. Тесты ниже фиксируют оба режима — «хэндлера нет» (по
// умолчанию) и «хэндлер есть» (диагностика «постоянно нужно логиниться
// заново», 2026-08-21, пункт 4).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { api, ApiError, setTokenProvider, setRefreshHandler, reportClientError } from './api';
import { clearApiCache } from '../../shared/src/api/apiCache';

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
  // Кеш GET-ответов (apiCache.ts) живёт в памяти модуля — без сброса каждый
  // повторный api.getSettings() в этом файле отвечал бы из кеша предыдущего
  // теста, а не бил mock fetch заново.
  clearApiCache();
  setTokenProvider(() => null);
  // По умолчанию — режим «хэндлера нет» (как в проде до маунта TokenBridge):
  // refresh не удался, authedFetch отдаёт исходный 401 без второго запроса.
  // Это сохраняет старое поведение всех тестов ниже, кроме тех, что явно
  // регистрируют свой хэндлер (describe «setRefreshHandler» в конце файла).
  setRefreshHandler(() => Promise.resolve(false));
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
    // Второй вызов обязан реально дойти до сети (а не отдаться из свежего
    // кеша apiCache.ts) — тест проверяет именно чтение токена ПЕРЕД отправкой.
    clearApiCache();
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
  it('get<T>: бросает ApiError со status=401 и серверным message, НЕ обращается к /api/auth/refresh, НЕ ретраит', async () => {
    fetchMock.mockResolvedValue(jsonResponse(401, { message: 'Unauthorized' }));

    // Ветвление потребителей — по полю status (ArticlePage: 404 ≠ сеть),
    // текст message приходит с сервера и может меняться свободно.
    await expect(api.getSettings()).rejects.toMatchObject({ status: 401, message: 'Unauthorized' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    fetchMock.mockClear();
    fetchMock.mockResolvedValue(jsonResponse(401, { message: 'Unauthorized' }));
    await expect(api.getSettings()).rejects.toBeInstanceOf(ApiError);

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
  it('get<T>: непарсибельное тело — фолбэк "API error: <status>", status полем сохранён', async () => {
    const res = brokenJsonResponse(500); // res.json() падает — остаётся код статуса
    fetchMock.mockResolvedValue(res);

    await expect(api.getSettings()).rejects.toMatchObject({ status: 500, message: 'API error: 500' });
  });

  it('del: непарсибельное тело — фолбэк "API error: <status>"; message из тела пробрасывается, когда есть', async () => {
    fetchMock.mockResolvedValue(brokenJsonResponse(403));
    await expect(api.deletePractice(1)).rejects.toMatchObject({ status: 403, message: 'API error: 403' });

    fetchMock.mockResolvedValue(jsonResponse(409, { message: 'Уже удалено' }));
    await expect(api.deletePractice(1)).rejects.toMatchObject({ status: 409, message: 'Уже удалено' });
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

  // ── apiError — общая функция разбора тела ошибки (post/postJson/patchJson/
  // adminReq зовут одну и ту же, вынесенную из четырёх копий одного блока) ──
  it('ошибка: message-строка из тела становится текстом Error', async () => {
    fetchMock.mockResolvedValue(jsonResponse(409, { message: 'Занято' }));
    await expect(
      api.createBeliefCheck({ belief: 'x', evidenceFor: [], evidenceAgainst: [] }),
    ).rejects.toThrow('Занято');
  });

  it('ошибка: message не строка (объект/массив) — в текст уходит JSON.stringify', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(400, { message: { field: 'belief', code: 'required' } }),
    );
    await expect(
      api.createBeliefCheck({ belief: '', evidenceFor: [], evidenceAgainst: [] }),
    ).rejects.toThrow(JSON.stringify({ field: 'belief', code: 'required' }));
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

// ── saveRating — оффлайн-надёжность (правило №3 CLAUDE.md) ───────────────────
// До 2026-08 сетевой сбой saveRating терялся молча: голый fetch без outbox,
// а TrackerOverlay глушил отказ `catch {}` — центральное ежедневное действие
// продукта было надёжным только в мини-аппе. Теперь тот же контракт, что там
// (schema-miniapp/src/api.ts): 4xx — реальная ошибка запроса, пробрасывается;
// сеть/таймаут/5xx — оценка уходит в общую (shared) outbox-очередь и ответ
// приходит успешным (сервер upsert-ит по (userId, date, needId), повтор
// безопасен).
const OUTBOX_KEY = 'rating_outbox_v1';

describe('saveRating — прямой fetch-вызов', () => {
  beforeEach(() => {
    localStorage.removeItem(OUTBOX_KEY);
  });

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

  it('4xx: бросает Error("API error: <status>"), НЕ кладёт оценку в outbox', async () => {
    fetchMock.mockResolvedValue(jsonResponse(404, {}));
    await expect(
      api.saveRating('safety', 7, '2026-01-15'),
    ).rejects.toThrow('API error: 404');
    expect(localStorage.getItem(OUTBOX_KEY)).toBeNull();
  });

  it('5xx: НЕ бросает — оценка уходит в outbox, ответ успешен (allDone: false)', async () => {
    fetchMock.mockResolvedValue(jsonResponse(500, {}));
    const result = await api.saveRating('safety', 7, '2026-01-15');

    expect(result).toEqual({ ok: true, allDone: false });
    expect(JSON.parse(localStorage.getItem(OUTBOX_KEY)!)).toEqual([
      { needId: 'safety', value: 7, date: '2026-01-15' },
    ]);
  });

  it('сетевой сбой (fetch реджектится): НЕ бросает — оценка уходит в outbox, ответ успешен', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));
    const result = await api.saveRating('safety', 7, '2026-01-15');

    expect(result).toEqual({ ok: true, allDone: false });
    expect(JSON.parse(localStorage.getItem(OUTBOX_KEY)!)).toEqual([
      { needId: 'safety', value: 7, date: '2026-01-15' },
    ]);
  });

  it('без явной даты — в outbox уходит today() (upsert должен видеть "сегодня по мнению юзера")', async () => {
    fetchMock.mockRejectedValue(new TypeError('offline'));
    await api.saveRating('safety', 7);

    const queued = JSON.parse(localStorage.getItem(OUTBOX_KEY)!);
    expect(queued).toHaveLength(1);
    expect(queued[0].date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

// ── flushOutbox — read-after-write: сохранил при упавшей сети → флаш при
// следующем старте дошивает очередь и чистит её (см. useBootstrapLoad.ts).
describe('flushOutbox — связка сохранение→отправка', () => {
  beforeEach(() => {
    localStorage.removeItem(OUTBOX_KEY);
  });

  it('доотправляет накопленную оценку и очищает очередь', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    await api.saveRating('safety', 6, '2026-01-15');
    expect(localStorage.getItem(OUTBOX_KEY)).not.toBeNull();

    fetchMock.mockResolvedValueOnce(jsonResponse(200, { ok: true, allDone: false }));
    await api.flushOutbox();

    expect(localStorage.getItem(OUTBOX_KEY)).toBeNull();
    const [, init] = fetchMock.mock.calls[1];
    expect(JSON.parse(init.body)).toEqual({
      needId: 'safety',
      value: 6,
      date: '2026-01-15',
    });
  });

  it('шлёт outbox_flush в аналитику, только если реально что-то доехало', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('offline'));
    await api.saveRating('safety', 6, '2026-01-15');

    fetchMock.mockResolvedValueOnce(jsonResponse(200, { ok: true, allDone: false }));
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { ok: true })); // /api/event
    await api.flushOutbox();

    const eventCall = fetchMock.mock.calls.find(([url]) =>
      String(url).includes('/api/event'),
    );
    expect(eventCall).toBeDefined();
    const [, init] = eventCall!;
    expect(JSON.parse(init.body)).toEqual({
      name: 'outbox_flush',
      meta: { count: 1 },
    });
  });

  it('пустая очередь — ничего не отправляет', async () => {
    await api.flushOutbox();
    expect(fetchMock).not.toHaveBeenCalled();
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

// ── Терапевтические эндпоинты (клиент/концептуализация/дневник) — TEST_COVERAGE_PLAN этап 4 ──
describe('терапевтические эндпоинты — URL и метод', () => {
  it('getAllTherapyTasks: GET /api/therapy/tasks/all', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, []));
    await api.getAllTherapyTasks();
    expect(String(fetchMock.mock.calls[0][0])).toContain('/api/therapy/tasks/all');
    expect(fetchMock.mock.calls[0][1].method).toBeUndefined(); // GET по умолчанию
  });

  it('getConceptualization: GET по clientId в пути', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, null));
    await api.getConceptualization(42);
    expect(String(fetchMock.mock.calls[0][0])).toContain('/api/therapy/conceptualization/42');
  });

  it('saveConceptualization: POST с телом концептуализации', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, {}));
    await api.saveConceptualization(42, { schemaIds: ['abandonment'], modeIds: [] });
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain('/api/therapy/conceptualization/42');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual({ schemaIds: ['abandonment'], modeIds: [] });
  });

  it('getTherapyClientHistory: GET по clientId', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, []));
    await api.getTherapyClientHistory(7);
    expect(String(fetchMock.mock.calls[0][0])).toContain('/api/therapy/client-history/7');
  });

  it('getClientDiary: GET по clientId', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, []));
    await api.getClientDiary(7);
    expect(String(fetchMock.mock.calls[0][0])).toContain('/api/therapy/client/7/diary');
  });
});

// ── Личный контент (разборы фраз, убеждения, письма, безопасное место, карточки) ──
describe('личный контент — URL, метод, тело запроса', () => {
  it('getPhraseChecks: GET /api/phrase-checks', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, []));
    await api.getPhraseChecks();
    expect(String(fetchMock.mock.calls[0][0])).toContain('/api/phrase-checks');
  });

  it('createPhraseCheck: POST /api/phrase-checks с телом разбора', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, {}));
    await api.createPhraseCheck({ phrase: 'я всё порчу', marks: ['worth'], rewrite: 'бывает, поправимо', inWarmWords: true });
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain('/api/phrase-checks');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual({ phrase: 'я всё порчу', marks: ['worth'], rewrite: 'бывает, поправимо', inWarmWords: true });
  });

  it('updatePhraseCheck: PATCH /api/phrase-checks/:id с rewrite', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { id: 5, rewrite: 'новый ответ' }));
    await api.updatePhraseCheck(5, 'новый ответ');
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain('/api/phrase-checks/5');
    expect(init.method).toBe('PATCH');
    expect(JSON.parse(init.body)).toEqual({ rewrite: 'новый ответ' });
  });

  it('deletePhraseCheck: DELETE по id', async () => {
    fetchMock.mockResolvedValue(jsonResponse(204, undefined));
    await api.deletePhraseCheck(5);
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain('/api/phrase-checks/5');
    expect(init.method).toBe('DELETE');
  });

  it('getBeliefChecks: GET /api/belief-checks', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, []));
    await api.getBeliefChecks();
    expect(String(fetchMock.mock.calls[0][0])).toContain('/api/belief-checks');
  });

  it('deleteBeliefCheck: DELETE по id', async () => {
    fetchMock.mockResolvedValue(jsonResponse(204, undefined));
    await api.deleteBeliefCheck(3);
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain('/api/belief-checks/3');
    expect(init.method).toBe('DELETE');
  });

  it('getLetters / createLetter / deleteLetter', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, []));
    await api.getLetters();
    expect(String(fetchMock.mock.calls[0][0])).toContain('/api/letters');

    fetchMock.mockResolvedValue(jsonResponse(200, {}));
    await api.createLetter('дорогой я');
    const [, init] = fetchMock.mock.calls[1];
    expect(JSON.parse(init.body)).toEqual({ text: 'дорогой я' });

    fetchMock.mockResolvedValue(jsonResponse(204, undefined));
    await api.deleteLetter(9);
    expect(String(fetchMock.mock.calls[2][0])).toContain('/api/letters/9');
  });

  it('getSafePlace / saveSafePlace', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, null));
    await api.getSafePlace();
    expect(String(fetchMock.mock.calls[0][0])).toContain('/api/safe-place');

    fetchMock.mockResolvedValue(jsonResponse(200, {}));
    await api.saveSafePlace('тихая комната');
    const [, init] = fetchMock.mock.calls[1];
    expect(JSON.parse(init.body)).toEqual({ description: 'тихая комната' });
  });

  it('getFlashcards / createFlashcard / deleteFlashcard', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, []));
    await api.getFlashcards();
    expect(String(fetchMock.mock.calls[0][0])).toContain('/api/flashcards');

    fetchMock.mockResolvedValue(jsonResponse(200, {}));
    await api.createFlashcard({ modeId: 'critic', needId: 'safety' });
    const [, init] = fetchMock.mock.calls[1];
    expect(JSON.parse(init.body)).toEqual({ modeId: 'critic', needId: 'safety' });

    fetchMock.mockResolvedValue(jsonResponse(204, undefined));
    await api.deleteFlashcard(5);
    expect(String(fetchMock.mock.calls[2][0])).toContain('/api/flashcards/5');
  });
});

// ── Бронирование, донаты, подписка ────────────────────────────────────────────
describe('бронирование / донаты / подписка — тело и URL', () => {
  it('submitBooking: POST с телом заявки', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { ok: true }));
    await api.submitBooking({ name: 'Аня', contact: '@anna', message: 'привет' });
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain('/api/booking');
    expect(JSON.parse(init.body)).toEqual({ name: 'Аня', contact: '@anna', message: 'привет' });
  });

  it('getBookingOptions: GET /api/booking/options', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, []));
    await api.getBookingOptions();
    expect(String(fetchMock.mock.calls[0][0])).toContain('/api/booking/options');
  });

  it('bookSlot: POST с полным телом слота', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { id: 1, cancelToken: 'tok', heldUntil: null, status: 'held' }));
    await api.bookSlot({ startsAt: '2026-01-01T10:00:00Z', clientName: 'Аня', clientContact: '@anna' });
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain('/api/booking/book');
    expect(JSON.parse(init.body)).toEqual({ startsAt: '2026-01-01T10:00:00Z', clientName: 'Аня', clientContact: '@anna' });
  });

  it('getBookingByToken: GET по токену', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { status: 'confirmed' }));
    await api.getBookingByToken('tok123');
    expect(String(fetchMock.mock.calls[0][0])).toContain('/api/booking/by-token/tok123');
  });

  it('cancelBooking: POST по токену', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { ok: true }));
    await api.cancelBooking('tok123');
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain('/api/booking/cancel/tok123');
    expect(init.method).toBe('POST');
  });

  it('donate: POST с суммой доната', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { id: 1, paymentUrl: null }));
    await api.donate({ amount: 500, source: 'app' });
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain('/api/donation');
    expect(JSON.parse(init.body)).toEqual({ amount: 500, source: 'app' });
  });

  it('getSubscriptionOptions: GET /api/subscription/options', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { enabled: true, options: [] }));
    await api.getSubscriptionOptions();
    expect(String(fetchMock.mock.calls[0][0])).toContain('/api/subscription/options');
  });

  it('subscribe: POST с периодом подписки', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { id: 1, cancelToken: 'tok', paymentUrl: null }));
    await api.subscribe({ period: 'month' });
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain('/api/subscription');
    expect(JSON.parse(init.body)).toEqual({ period: 'month' });
  });

  it('getSubscriptionByToken / cancelSubscription', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { status: 'active' }));
    await api.getSubscriptionByToken('sub-tok');
    expect(String(fetchMock.mock.calls[0][0])).toContain('/api/subscription/by-token/sub-tok');

    fetchMock.mockResolvedValue(jsonResponse(200, { ok: true }));
    await api.cancelSubscription('sub-tok');
    expect(String(fetchMock.mock.calls[1][0])).toContain('/api/subscription/cancel/sub-tok');
  });
});

// ── Админ: цены/правила/статьи/контент сайта/фразы канала/кастом-режимы/карты режимов ──
describe('админские эндпоинты — оставшиеся методы', () => {
  it('adminGetSubPrices / adminSetSubPrice', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, []));
    await api.adminGetSubPrices('key');
    expect(String(fetchMock.mock.calls[0][0])).toContain('/api/booking/admin/sub-prices');

    fetchMock.mockResolvedValue(jsonResponse(200, { ok: true }));
    await api.adminSetSubPrice('key', 'year', 9000);
    const [, init] = fetchMock.mock.calls[1];
    expect(JSON.parse(init.body)).toEqual({ period: 'year', amount: 9000 });
  });

  it('adminListRules / adminCreateRule / adminToggleRule', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, []));
    await api.adminListRules('key');
    expect(String(fetchMock.mock.calls[0][0])).toContain('/api/booking/admin/rules');

    fetchMock.mockResolvedValue(jsonResponse(200, {}));
    await api.adminCreateRule('key', { dayOfWeek: 1, startHour: 9, endHour: 18 });
    const [, createInit] = fetchMock.mock.calls[1];
    expect(JSON.parse(createInit.body)).toEqual({ dayOfWeek: 1, startHour: 9, endHour: 18 });

    fetchMock.mockResolvedValue(jsonResponse(200, {}));
    await api.adminToggleRule('key', 5, false);
    const [toggleUrl, toggleInit] = fetchMock.mock.calls[2];
    expect(String(toggleUrl)).toContain('/api/booking/admin/rules/5');
    expect(JSON.parse(toggleInit.body)).toEqual({ isActive: false });
  });

  it('adminConfirm: POST по id брони', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { ok: true }));
    await api.adminConfirm('key', 8);
    expect(String(fetchMock.mock.calls[0][0])).toContain('/api/booking/admin/confirm/8');
  });

  it('listArticles / getArticle — публичные, без ключа', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, []));
    await api.listArticles();
    expect(String(fetchMock.mock.calls[0][0])).toContain('/api/articles');

    fetchMock.mockResolvedValue(jsonResponse(200, {}));
    await api.getArticle('trevoga-i-telo');
    expect(String(fetchMock.mock.calls[1][0])).toContain('/api/articles/trevoga-i-telo');
  });

  it('adminListArticles / adminCreateArticle / adminUpdateArticle / adminDeleteArticle', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, []));
    await api.adminListArticles('key');
    expect(String(fetchMock.mock.calls[0][0])).toContain('/api/articles/admin/list');

    const dto = { slug: 's', title: 'T', description: 'd', content: '<p></p>', date: '2026-01-01', readMin: 5 };
    fetchMock.mockResolvedValue(jsonResponse(200, {}));
    await api.adminCreateArticle('key', dto);
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual(dto);

    fetchMock.mockResolvedValue(jsonResponse(200, {}));
    await api.adminUpdateArticle('key', 3, { title: 'Новый заголовок' });
    const [updUrl, updInit] = fetchMock.mock.calls[2];
    expect(String(updUrl)).toContain('/api/articles/admin/3');
    expect(JSON.parse(updInit.body)).toEqual({ title: 'Новый заголовок' });

    fetchMock.mockResolvedValue(jsonResponse(204, undefined));
    await api.adminDeleteArticle('key', 3);
    expect(String(fetchMock.mock.calls[3][0])).toContain('/api/articles/admin/3');
  });

  it('getSiteContent / adminSetHeroPhoto / adminSetMarquee', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { heroPhoto: null, marqueeTopicsA: [], marqueeTopicsB: [] }));
    await api.getSiteContent();
    expect(String(fetchMock.mock.calls[0][0])).toContain('/api/site-content');

    fetchMock.mockResolvedValue(jsonResponse(200, { ok: true }));
    await api.adminSetHeroPhoto('key', 'data:image/jpeg;base64,X');
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({ dataUri: 'data:image/jpeg;base64,X' });

    fetchMock.mockResolvedValue(jsonResponse(200, { ok: true }));
    await api.adminSetMarquee('key', 'A', [{ label: 'Тревога', href: '/articles/anx' }]);
    expect(JSON.parse(fetchMock.mock.calls[2][1].body)).toEqual({ group: 'A', topics: [{ label: 'Тревога', href: '/articles/anx' }] });
  });

  it('adminListPhrases / adminCreatePhrase / adminUpdatePhrase / adminDeletePhrase', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, []));
    await api.adminListPhrases('key');
    expect(String(fetchMock.mock.calls[0][0])).toContain('/api/healthy-adult/admin/list');

    fetchMock.mockResolvedValue(jsonResponse(200, {}));
    await api.adminCreatePhrase('key', 'Ты справишься');
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({ text: 'Ты справишься' });

    fetchMock.mockResolvedValue(jsonResponse(200, {}));
    await api.adminUpdatePhrase('key', 2, { enabled: false });
    const [updUrl, updInit] = fetchMock.mock.calls[2];
    expect(String(updUrl)).toContain('/api/healthy-adult/admin/2');
    expect(JSON.parse(updInit.body)).toEqual({ enabled: false });

    fetchMock.mockResolvedValue(jsonResponse(204, undefined));
    await api.adminDeletePhrase('key', 2);
    expect(String(fetchMock.mock.calls[3][0])).toContain('/api/healthy-adult/admin/2');
  });

  it('adminTestPhrasePost / adminImportPhrases / adminPhrasePoolStatus', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { ok: true, message: 'ок' }));
    await api.adminTestPhrasePost('key');
    expect(String(fetchMock.mock.calls[0][0])).toContain('/api/healthy-adult/admin/test-post');

    fetchMock.mockResolvedValue(jsonResponse(200, { created: [], message: 'готово' }));
    await api.adminImportPhrases('key', 'фраза1\nфраза2');
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({ text: 'фраза1\nфраза2' });

    fetchMock.mockResolvedValue(jsonResponse(200, { enabled: 10, unused: 3, daysLeft: 1 }));
    await api.adminPhrasePoolStatus('key');
    expect(String(fetchMock.mock.calls[2][0])).toContain('/api/healthy-adult/admin/pool-status');
  });

  it('listCustomModes / createCustomMode / deleteCustomMode', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, []));
    await api.listCustomModes();
    expect(String(fetchMock.mock.calls[0][0])).toContain('/api/therapy/custom-modes');

    fetchMock.mockResolvedValue(jsonResponse(200, {}));
    await api.createCustomMode({ name: 'Внутренний критик 2', emoji: '😡' });
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({ name: 'Внутренний критик 2', emoji: '😡' });

    fetchMock.mockResolvedValue(jsonResponse(204, undefined));
    await api.deleteCustomMode(4);
    expect(String(fetchMock.mock.calls[2][0])).toContain('/api/therapy/custom-modes/4');
  });

  it('listModeMaps / getModeMap / deleteModeMap — CRUD по картам режимов', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, []));
    await api.listModeMaps(11);
    expect(String(fetchMock.mock.calls[0][0])).toContain('/api/therapy/mode-maps/11');

    fetchMock.mockResolvedValue(jsonResponse(200, {}));
    await api.getModeMap(99);
    expect(String(fetchMock.mock.calls[1][0])).toContain('/api/therapy/mode-maps/map/99');

    fetchMock.mockResolvedValue(jsonResponse(204, undefined));
    await api.deleteModeMap(99);
    expect(String(fetchMock.mock.calls[2][0])).toContain('/api/therapy/mode-maps/map/99');
  });

  it('listMyModeMaps / getMyModeMap — карты клиента, доступные только для чтения', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, []));
    await api.listMyModeMaps();
    expect(String(fetchMock.mock.calls[0][0])).toContain('/api/therapy/my-mode-maps');

    fetchMock.mockResolvedValue(jsonResponse(200, {}));
    await api.getMyModeMap(99);
    expect(String(fetchMock.mock.calls[1][0])).toContain('/api/therapy/my-mode-maps/99');
  });
});

// ── setRefreshHandler — 401 перевыпускает сессию и повторяет запрос ──────────
// Диагностика «постоянно нужно логиниться заново» (2026-08-21, пункт 4): у
// сайта не было НИ ОДНОЙ попытки перевыпустить сессию на 401 обычного
// запроса — мини-апп это уже умел (apiClient.ts:authedFetch), сайт просто
// бросал ошибку. В проде хэндлер кладёт TokenBridge (App.tsx), здесь —
// напрямую через setRefreshHandler (зеркало schema-miniapp/src/apiClient.test.ts).
describe('setRefreshHandler — 401 → перевыпуск сессии → повтор запроса', () => {
  it('успешный refresh повторяет запрос и получает данные', async () => {
    setRefreshHandler(() => Promise.resolve(true));
    fetchMock
      .mockResolvedValueOnce(jsonResponse(401, {})) // исходный запрос: токен истёк
      .mockResolvedValueOnce(jsonResponse(200, { addressForm: 'ty' })); // повтор — уже с новым токеном

    await expect(api.getSettings()).resolves.toEqual({ addressForm: 'ty' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('POST/postJson тоже повторяется — действие не теряется из-за истёкшей сессии', async () => {
    setRefreshHandler(() => Promise.resolve(true));
    fetchMock
      .mockResolvedValueOnce(jsonResponse(401, {}))
      .mockResolvedValueOnce(jsonResponse(200, { ok: true }));

    await expect(api.updateName('Аня')).resolves.toEqual({ ok: true });
    const [, retryInit] = fetchMock.mock.calls[1];
    expect(JSON.parse(retryInit.body)).toEqual({ name: 'Аня' });
  });

  it('refresh не удался (сессия мертва) — единственный запрос, ошибка исходного 401 долетает как есть', async () => {
    setRefreshHandler(() => Promise.resolve(false));
    fetchMock.mockResolvedValue(jsonResponse(401, { message: 'Unauthorized' }));

    await expect(api.getSettings()).rejects.toMatchObject({ status: 401 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('успешный запрос не трогает refresh-хэндлер — лишних вызовов нет', async () => {
    const refresh = vi.fn().mockResolvedValue(true);
    setRefreshHandler(refresh);
    fetchMock.mockResolvedValue(jsonResponse(200, {}));

    await api.getSettings();

    expect(refresh).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('повторный запрос всё равно 401 — второй раз не рефрешит, ошибка долетает', async () => {
    setRefreshHandler(() => Promise.resolve(true));
    fetchMock.mockResolvedValue(jsonResponse(401, {})); // и исходный, и повтор — 401

    await expect(api.getSettings()).rejects.toMatchObject({ status: 401 });
    // Один поход к refresh-хэндлеру, два похода к самому эндпоинту (исходный + повтор).
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
