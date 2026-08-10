// Ретранслятор Threads (deploy/threads-relay/worker.js, Cloudflare Worker) —
// работает в проде и содержит AUTH-путь (`sameSecret` — сверку
// `x-relay-key` с секретом RELAY_SECRET), но до этого теста на него не
// смотрел НИ ОДИН гейт: check-dead-files.mjs ходит только по .ts(x) в
// src/webapp-src/miniapp-src/shared-src, check-public-scripts.mjs — только
// по public/. Файл вне обоих полей зрения — тот же класс, что уронил вход
// в мини-апп на 5 суток в инциденте 2026-08-08 (scripts/check-unwatched-code.mjs
// это теперь ловит; данный тест — конкретное лекарство для конкретного файла).
//
// Файл — настоящий ES-модуль (`export default { fetch }`), а Jest (ts-jest,
// CommonJS) без `--experimental-vm-modules` не умеет реальный динамический
// `import()` чужого файла (проверено: падает с «A dynamic import callback
// was invoked without --experimental-vm-modules»). deploy/*.mjs по той же
// причине гоняют отдельным процессом (front-server.spec.ts, wait-for-db.spec.ts) —
// здесь модуль достаточно мал, чтобы обойтись без spawn: читаем файл с диска
// и заменяем ЕДИНСТВЕННУЮ строку `export default` на `module.exports.default =`
// (единственная ESM-конструкция во всём файле — дальше чистый CommonJS-совместимый
// код), затем исполняем как обычно исполняли бы require() — как
// webapp/src/maxBridgeLoader.test.ts исполняет public/max-bridge.js через
// `new Function`. Логика воркера (sameSecret, fetch-хендлер) не тронута ни
// байтом — заменяется только форма экспорта.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const WORKER_PATH = resolve(
  __dirname,
  '../../deploy/threads-relay/worker.js',
);
const SOURCE = readFileSync(WORKER_PATH, 'utf8');

interface WorkerModule {
  fetch(
    request: {
      method: string;
      url: string;
      headers: { get(name: string): string | null };
    },
    env: Record<string, string>,
  ): Promise<Response>;
}

function loadWorker(): WorkerModule {
  const matches = SOURCE.match(/export default/g) ?? [];
  if (matches.length !== 1) {
    // Если в файле появится больше ESM-конструкций, простая замена ниже
    // молча даст неполный/неверный модуль — лучше упасть громко тут, чем
    // тестировать не тот код.
    throw new Error(
      `worker.js: ожидалась ровно одна конструкция "export default", найдено ${matches.length}`,
    );
  }
  const transformed = SOURCE.replace(
    'export default',
    'module.exports.default =',
  );
  const module = { exports: {} as { default?: WorkerModule } };
  new Function('module', 'exports', transformed)(module, module.exports);
  if (!module.exports.default) {
    throw new Error('worker.js: module.exports.default не заполнен');
  }
  return module.exports.default;
}

/** Минимальная фейковая Request с case-insensitive заголовками — ровно то,
 * что worker.js реально читает (`request.headers.get(...)`, `.method`, `.url`). */
function fakeRequest(opts: {
  method?: string;
  headers?: Record<string, string>;
  url?: string;
}) {
  const lower = new Map(
    Object.entries(opts.headers ?? {}).map(([k, v]) => [k.toLowerCase(), v]),
  );
  return {
    method: opts.method ?? 'GET',
    url: opts.url ?? 'https://relay.example/v1/me/threads?fields=id',
    headers: { get: (name: string) => lower.get(name.toLowerCase()) ?? null },
  };
}

const SECRET = 'a-real-relay-secret-value';
const ENV = { RELAY_SECRET: SECRET };

describe('deploy/threads-relay/worker.js (Cloudflare Worker — ретранслятор Threads)', () => {
  const realFetch = global.fetch;
  afterEach(() => {
    global.fetch = realFetch;
  });

  it('верный секрет → запрос пробрасывается в graph.threads.net', async () => {
    const worker = loadWorker();
    const fetchMock = jest.fn().mockResolvedValue({
      status: 200,
      text: () => Promise.resolve('{"id":"1"}'),
      headers: { get: () => 'application/json' },
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const res = await worker.fetch(
      fakeRequest({
        headers: { 'x-relay-key': SECRET },
        url: 'https://relay.example/v1/123/threads?fields=id',
      }),
      ENV,
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [target] = fetchMock.mock.calls[0] as [string];
    expect(target).toBe('https://graph.threads.net/v1/123/threads?fields=id');
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('{"id":"1"}');
  });

  it('неверный секрет → 403, апстрим не трогаем', async () => {
    const worker = loadWorker();
    const fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;

    const res = await worker.fetch(
      fakeRequest({ headers: { 'x-relay-key': 'wrong-guess' } }),
      ENV,
    );

    expect(res.status).toBe(403);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  // Ключевой случай: секрет ТОЙ ЖЕ длины, но другим содержимым. Без него
  // «неверный секрет → 403» проходит на одной только проверке длины, а
  // побайтовое сравнение остаётся непроверенным: мутант `return diff === 0`
  // → `return true` переживал весь файл (проверено руками). Две позиции —
  // первая и последняя — чтобы не пройти на сравнении одного края.
  it.each([
    ['последний байт', `${SECRET.slice(0, -1)}X`],
    ['первый байт', `X${SECRET.slice(1)}`],
  ])(
    'секрет верной длины, но отличается (%s) → 403, апстрим не трогаем',
    async (_label, guess) => {
      const worker = loadWorker();
      const fetchMock = jest.fn();
      global.fetch = fetchMock as unknown as typeof fetch;

      expect(guess).toHaveLength(SECRET.length);
      expect(guess).not.toBe(SECRET);

      const res = await worker.fetch(
        fakeRequest({ headers: { 'x-relay-key': guess } }),
        ENV,
      );

      expect(res.status).toBe(403);
      expect(fetchMock).not.toHaveBeenCalled();
    },
  );

  it('заголовок с секретом отсутствует → 403, апстрим не трогаем', async () => {
    const worker = loadWorker();
    const fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;

    const res = await worker.fetch(fakeRequest({}), ENV);

    expect(res.status).toBe(403);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('секрет другой длины (в т.ч. длиннее настоящего) → 403 без исключения', async () => {
    const worker = loadWorker();
    global.fetch = jest.fn() as unknown as typeof fetch;

    const shorter = await worker.fetch(
      fakeRequest({ headers: { 'x-relay-key': SECRET.slice(0, 3) } }),
      ENV,
    );
    const longer = await worker.fetch(
      fakeRequest({ headers: { 'x-relay-key': `${SECRET}x` } }),
      ENV,
    );

    expect(shorter.status).toBe(403);
    expect(longer.status).toBe(403);
  });

  it('RELAY_SECRET не настроен на воркере → 500, до сверки секрета не доходит', async () => {
    const worker = loadWorker();
    const fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;

    const res = await worker.fetch(
      fakeRequest({ headers: { 'x-relay-key': SECRET } }),
      {},
    );

    expect(res.status).toBe(500);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('метод не GET/POST → 405, даже с верным секретом', async () => {
    const worker = loadWorker();
    const fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;

    const res = await worker.fetch(
      fakeRequest({ method: 'DELETE', headers: { 'x-relay-key': SECRET } }),
      ENV,
    );

    expect(res.status).toBe(405);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('апстрим падает (сеть) → 502 с причиной в теле, не исключение наружу', async () => {
    const worker = loadWorker();
    global.fetch = jest
      .fn()
      .mockRejectedValue(new Error('network unreachable')) as unknown as typeof fetch;

    const res = await worker.fetch(
      fakeRequest({ headers: { 'x-relay-key': SECRET } }),
      ENV,
    );

    expect(res.status).toBe(502);
    expect(await res.text()).toContain('network unreachable');
  });
});
