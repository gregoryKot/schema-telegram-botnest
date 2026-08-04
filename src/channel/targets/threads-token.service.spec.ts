// Токен Threads живёт 60 дней и обновляется только сам собой: если обновление
// тихо сломается, канал замолчит через два месяца без единого признака.
// Поэтому под тестом и хранение (шифрованное), и порог обновления, и то, что
// сбой обновления не роняет тик.
import { Logger } from '@nestjs/common';
import { ThreadsTokenService } from './threads-token.service';
import type { PrismaService } from '../../prisma/prisma.service';

// Шифрование подменяем: в тестовой среде ENCRYPTION_KEY нет и настоящий
// encrypt отдаёт текст как есть — тогда проверка «в БД не открытый текст»
// ничего не значила бы. Мок делает шифрование видимым и детерминированным.
// Напрямую в Meta запрос уходит клиентом undici (у него своё окно на
// установление соединения), поэтому подменяем именно его.
const undiciFetch = jest.fn();
jest.mock('undici', () => ({
  ...jest.requireActual('undici'),
  fetch: (...args: unknown[]) => undiciFetch(...args),
}));

jest.mock('../../utils/crypto', () => ({
  encrypt: jest.fn((t: string | null) => (t ? `enc(${t})` : null)),
  decrypt: (v: string | null) =>
    v?.startsWith('enc(') ? v.slice(4, -1) : (v ?? null),
}));
import { encrypt } from '../../utils/crypto';
const encryptMock = encrypt as jest.Mock;

const KEY = 'channel:threads_token';

function makePrisma(row: { value: string; updatedAt: Date } | null) {
  const upsert = jest.fn().mockResolvedValue(undefined);
  const findUnique = jest.fn().mockResolvedValue(row);
  return {
    prisma: {
      bookingSetting: { findUnique, upsert },
    } as unknown as PrismaService,
    findUnique,
    upsert,
  };
}

const daysAgo = (n: number) => new Date(Date.now() - n * 24 * 60 * 60 * 1000);

describe('ThreadsTokenService', () => {
  const OLD = process.env.HEALTHY_ADULT_THREADS_TOKEN;
  const realFetch = global.fetch;
  beforeEach(() => undiciFetch.mockReset());
  afterEach(() => {
    if (OLD === undefined) delete process.env.HEALTHY_ADULT_THREADS_TOKEN;
    else process.env.HEALTHY_ADULT_THREADS_TOKEN = OLD;
    global.fetch = realFetch;
    jest.restoreAllMocks();
  });

  it('без сохранённого берёт стартовый токен из env', async () => {
    process.env.HEALTHY_ADULT_THREADS_TOKEN = 'seed-token';
    const { prisma } = makePrisma(null);
    await expect(new ThreadsTokenService(prisma).current()).resolves.toBe(
      'seed-token',
    );
  });

  it('сохранённый токен важнее env — обновлённый не откатывается', async () => {
    process.env.HEALTHY_ADULT_THREADS_TOKEN = 'seed-token';
    const { prisma } = makePrisma({
      value: 'enc(fresh-token)',
      updatedAt: daysAgo(1),
    });
    await expect(new ThreadsTokenService(prisma).current()).resolves.toBe(
      'fresh-token',
    );
  });

  it('падение БД не оставляет канал без токена — берём env', async () => {
    process.env.HEALTHY_ADULT_THREADS_TOKEN = 'seed-token';
    const { prisma, findUnique } = makePrisma(null);
    findUnique.mockRejectedValue(new Error('db down'));
    await expect(new ThreadsTokenService(prisma).current()).resolves.toBe(
      'seed-token',
    );
  });

  it('в БД токен ложится зашифрованным, а не открытым текстом', async () => {
    process.env.HEALTHY_ADULT_THREADS_TOKEN = 'seed-token';
    const { prisma, upsert } = makePrisma(null);
    await new ThreadsTokenService(prisma).refreshIfStale();
    expect(upsert).toHaveBeenCalledTimes(1);
    const { where, create } = upsert.mock.calls[0][0];
    expect(where).toEqual({ key: KEY });
    expect(create.value).toBe('enc(seed-token)');
  });

  it('свежий токен не трогаем — лишний обмен только злит площадку', async () => {
    const { prisma, upsert, findUnique } = makePrisma({
      value: 'enc(fresh-token)',
      updatedAt: daysAgo(3),
    });
    const fetchMock = jest.fn();
    global.fetch = fetchMock;
    await new ThreadsTokenService(prisma).refreshIfStale();
    // Возраст токена берётся из той самой строки, а не гадается по env.
    expect(findUnique).toHaveBeenCalledWith({
      where: { key: KEY },
      select: { value: true, updatedAt: true },
    });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(upsert).not.toHaveBeenCalled();
  });

  it('токен старше 30 дней меняется на свежий и сохраняется', async () => {
    const { prisma, upsert } = makePrisma({
      value: 'enc(old-token)',
      updatedAt: daysAgo(45),
    });
    undiciFetch.mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => '{"access_token":"renewed","expires_in":5184000}',
    });
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);

    await new ThreadsTokenService(prisma).refreshIfStale();

    expect(String(undiciFetch.mock.calls[0][0])).toContain(
      'refresh_access_token?grant_type=th_refresh_token&access_token=old-token',
    );
    expect(upsert).toHaveBeenCalledTimes(1);
    expect(upsert.mock.calls[0][0].update.value).toBe('enc(renewed)');
  });

  it('сбой обновления не роняет крон и предупреждает, а не будит', async () => {
    const { prisma, upsert } = makePrisma({
      value: 'enc(old-token)',
      updatedAt: daysAgo(45),
    });
    undiciFetch.mockResolvedValue({
      ok: false,
      status: 400,
      text: async () => 'invalid token',
    });
    const warn = jest
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);
    const error = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);

    await expect(
      new ThreadsTokenService(prisma).refreshIfStale(),
    ).resolves.toBeUndefined();
    expect(upsert).not.toHaveBeenCalled();
    expect(String(warn.mock.calls[0][0])).toContain('400: invalid token');
    expect(error).not.toHaveBeenCalled();
  });

  it('ответ 200 без access_token тоже считается сбоем — не сохраняем пустоту', async () => {
    // Meta может ответить 200 с телом без access_token (например при смене
    // формата ответа) — раньше это тихо перезаписало бы токен пустой строкой,
    // и канал замолчал бы без единого warn.
    const { prisma, upsert } = makePrisma({
      value: 'enc(old-token)',
      updatedAt: daysAgo(45),
    });
    undiciFetch.mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => '{"expires_in":5184000}',
    });
    const warn = jest
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);

    await new ThreadsTokenService(prisma).refreshIfStale();

    expect(upsert).not.toHaveBeenCalled();
    expect(String(warn.mock.calls[0][0])).toContain(
      'в ответе нет access_token',
    );
  });

  it('пустой шифртекст (encrypt вернул null) не пишет пустышку в БД', async () => {
    // save() — общий путь и для сида стартового токена, и для обновления;
    // если encrypt() не смог зашифровать (например, ENCRYPTION_KEY снят), в
    // БД не должно уйти undefined/null вместо реального секрета.
    process.env.HEALTHY_ADULT_THREADS_TOKEN = 'seed-token';
    encryptMock.mockReturnValueOnce(null);
    const { prisma, upsert } = makePrisma(null);

    await new ThreadsTokenService(prisma).refreshIfStale();

    expect(encryptMock).toHaveBeenCalledWith('seed-token');
    expect(upsert).not.toHaveBeenCalled();
  });

  it('через ретранслятор обновление идёт туда же, куда публикация', async () => {
    // Обновлять токен напрямую с этого хостинга нельзя — Meta не отвечает, и
    // токен молча умер бы через 60 дней (инцидент 2026-07-31).
    process.env.HEALTHY_ADULT_THREADS_RELAY = 'https://zv.workers.dev';
    process.env.HEALTHY_ADULT_THREADS_RELAY_SECRET = 'ключ';
    const { prisma, upsert } = makePrisma({
      value: 'enc(old-token)',
      updatedAt: daysAgo(45),
    });
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => '{"access_token":"renewed"}',
    });
    global.fetch = fetchMock;
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);

    await new ThreadsTokenService(prisma).refreshIfStale();

    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe(
      'https://zv.workers.dev/refresh_access_token?grant_type=th_refresh_token&access_token=old-token',
    );
    expect(init.headers).toEqual({ 'x-relay-key': 'ключ' });
    expect(upsert.mock.calls[0][0].update.value).toBe('enc(renewed)');
    delete process.env.HEALTHY_ADULT_THREADS_RELAY;
    delete process.env.HEALTHY_ADULT_THREADS_RELAY_SECRET;
  });

  it('без токена вообще ничего не делает', async () => {
    delete process.env.HEALTHY_ADULT_THREADS_TOKEN;
    const { prisma, upsert } = makePrisma(null);
    const fetchMock = jest.fn();
    global.fetch = fetchMock;
    const service = new ThreadsTokenService(prisma);

    await service.refreshIfStale();

    // Нечего обновлять и нечем отправлять — площадка просто выключена.
    await expect(service.current()).resolves.toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(upsert).not.toHaveBeenCalled();
  });
});
