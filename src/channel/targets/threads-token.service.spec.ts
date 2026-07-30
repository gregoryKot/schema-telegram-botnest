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
jest.mock('../../utils/crypto', () => ({
  encrypt: (t: string | null) => (t ? `enc(${t})` : null),
  decrypt: (v: string | null) =>
    v?.startsWith('enc(') ? v.slice(4, -1) : (v ?? null),
}));

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
    const { prisma, upsert } = makePrisma({
      value: 'enc(fresh-token)',
      updatedAt: daysAgo(3),
    });
    const fetchMock = jest.fn();
    global.fetch = fetchMock;
    await new ThreadsTokenService(prisma).refreshIfStale();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(upsert).not.toHaveBeenCalled();
  });

  it('токен старше 30 дней меняется на свежий и сохраняется', async () => {
    const { prisma, upsert } = makePrisma({
      value: 'enc(old-token)',
      updatedAt: daysAgo(45),
    });
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => '{"access_token":"renewed","expires_in":5184000}',
    });
    global.fetch = fetchMock;
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);

    await new ThreadsTokenService(prisma).refreshIfStale();

    expect(String(fetchMock.mock.calls[0][0])).toContain(
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
    global.fetch = jest.fn().mockResolvedValue({
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

  it('без токена вообще ничего не делает', async () => {
    delete process.env.HEALTHY_ADULT_THREADS_TOKEN;
    const { prisma, upsert } = makePrisma(null);
    const fetchMock = jest.fn();
    global.fetch = fetchMock;
    await new ThreadsTokenService(prisma).refreshIfStale();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(upsert).not.toHaveBeenCalled();
  });
});
