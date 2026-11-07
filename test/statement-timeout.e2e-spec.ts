// statement_timeout на РЕАЛЬНОМ Postgres (правило №18; аудит 2026-10, «Нет
// таймаута запроса к БД»). Мок не докажет ни одного из свойств ниже: что
// стартовый параметр pg доходит до каждой сессии пула, что база отвечает
// SQLSTATE 57014 и в какой форме Prisma 7 его отдаёт, что ожидание блокировки
// входит в лимит и что `SET LOCAL` из исключения не протекает в пул.
//
// Долгие легитимные пути на прод-пороге: соседние живые спеки строят
// PrismaService так же (порог 30 с — первый тест ниже), то есть /stats
// (raw-sql-live-stats), VACUUM после удаления аккаунта (raw-sql-live-infra),
// ротация ключа (key-rotation) и полуночный обход (midnight-planner-resume)
// уже идут под ним; на объёме роста — test/perf/long-paths.ts (джоба perf).
import { ArgumentsHost, HttpStatus, Logger } from '@nestjs/common';
import { Client } from 'pg';
import { PrismaService } from '../src/prisma/prisma.service';
import { PrismaExceptionFilter } from '../src/prisma/prisma-exception.filter';
import {
  DEFAULT_STATEMENT_TIMEOUT_MS,
  MAX_STATEMENT_TIMEOUT_MS,
  isStatementTimeout,
  withStatementTimeout,
} from '../src/prisma/statement-timeout';

const SHORT_MS = 300;

/** Значения лимита на нескольких соединениях пула сразу (параллельно). */
async function sessionLimits(prisma: PrismaService, n: number) {
  const rows = await Promise.all(
    Array.from(
      { length: n },
      () =>
        prisma.$queryRaw<
          { statement_timeout: string }[]
        >`SHOW statement_timeout`,
    ),
  );
  return [...new Set(rows.map((r) => r[0].statement_timeout))];
}

async function rejection(p: Promise<unknown>): Promise<unknown> {
  try {
    await p;
  } catch (e) {
    return e;
  }
  throw new Error('запрос не упал, а должен был упереться в лимит');
}

describe('statement_timeout на реальном Postgres', () => {
  const prevEnv = process.env.DB_STATEMENT_TIMEOUT_MS;
  let prod: PrismaService;
  let short: PrismaService;
  let errorLog: jest.SpyInstance;

  beforeAll(async () => {
    errorLog = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
    delete process.env.DB_STATEMENT_TIMEOUT_MS;
    prod = new PrismaService();
    // Рубильник читается в конструкторе — так же, как на проде при старте.
    process.env.DB_STATEMENT_TIMEOUT_MS = String(SHORT_MS);
    short = new PrismaService();
    if (prevEnv === undefined) delete process.env.DB_STATEMENT_TIMEOUT_MS;
    else process.env.DB_STATEMENT_TIMEOUT_MS = prevEnv;
    await Promise.all([prod.$connect(), short.$connect()]);
  });

  afterAll(async () => {
    errorLog.mockRestore();
    await Promise.all([prod.$disconnect(), short.$disconnect()]);
  });

  beforeEach(() => errorLog.mockClear());

  it('прод-порог 30 с доходит до каждой сессии пула, а не только до первой', async () => {
    expect(DEFAULT_STATEMENT_TIMEOUT_MS).toBe(30_000);
    expect(await sessionLimits(prod, 5)).toEqual(['30s']);
  });

  it('лишний ноль в рубильнике — дефолт 30 с, а не FATAL на каждом соединении', async () => {
    const build = (raw: string) => {
      process.env.DB_STATEMENT_TIMEOUT_MS = raw;
      try {
        return new PrismaService();
      } finally {
        if (prevEnv === undefined) delete process.env.DB_STATEMENT_TIMEOUT_MS;
        else process.env.DB_STATEMENT_TIMEOUT_MS = prevEnv;
      }
    };
    const typo = build(`${MAX_STATEMENT_TIMEOUT_MS}0`);
    const atMax = build(String(MAX_STATEMENT_TIMEOUT_MS));
    try {
      expect(await sessionLimits(typo, 1)).toEqual(['30s']);
      // Потолок — ровно предел Postgres: на нём соединение ещё живо.
      expect(await sessionLimits(atMax, 1)).toEqual(['2147483647ms']);
    } finally {
      await Promise.all([typo.$disconnect(), atMax.$disconnect()]);
    }
    // Контроль: без защиты то же значение роняет само соединение.
    const raw = new Client({
      connectionString: process.env.DATABASE_URL,
      statement_timeout: MAX_STATEMENT_TIMEOUT_MS + 1,
    });
    await expect(raw.connect()).rejects.toThrow(
      'invalid value for parameter "statement_timeout"',
    );
  });

  it('сырой запрос сверх порога прерывается базой (57014), владельцу — строка с порогом', async () => {
    const started = Date.now();
    const err = await rejection(short.$executeRaw`SELECT pg_sleep(2)`);

    // Прервала база, а не дождались конца: 2 с сна не прошли.
    expect(Date.now() - started).toBeLessThan(1_500);
    expect(isStatementTimeout(err)).toBe(true);
    const lines = errorLog.mock.calls.map((c) => String(c[0]));
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatch(
      /^Запрос к БД прерван: дольше statement_timeout 300 мс — .*executeRaw/,
    );
  });

  it('модельный запрос, ждущий блокировку, тоже прерывается — ожидание замка входит в лимит', async () => {
    const locker = new Client({ connectionString: process.env.DATABASE_URL });
    await locker.connect();
    try {
      await locker.query('BEGIN');
      await locker.query('LOCK TABLE "CronLease" IN ACCESS EXCLUSIVE MODE');
      const err = await rejection(short.cronLease.findMany());
      expect(isStatementTimeout(err)).toBe(true);
      expect(String(errorLog.mock.calls[0]?.[0])).toContain(
        'cronLease.findMany()',
      );
    } finally {
      await locker.query('ROLLBACK');
      await locker.end();
    }
  });

  it('настоящая ошибка таймаута через HTTP-фильтр — 500 с текстом про базу, без второго DM (шов: форма ошибки живая)', async () => {
    const err = await rejection(short.$executeRaw`SELECT pg_sleep(2)`);
    const json = jest.fn();
    const res = { status: jest.fn(() => ({ json })) };
    const host = {
      switchToHttp: () => ({
        getResponse: () => res,
        getRequest: () => ({ url: '/api/tracker/history' }),
      }),
    } as unknown as ArgumentsHost;
    const warn = jest
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);
    errorLog.mockClear();

    new PrismaExceptionFilter().catch(err as Error, host);

    expect(res.status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'База данных не ответила вовремя' }),
    );
    expect(errorLog.mock.calls).toEqual([]);
    expect(warn.mock.calls.map((c) => String(c[0]))).toEqual([
      'Таймаут запроса к БД на /api/tracker/history',
    ]);
    warn.mockRestore();
  });

  it('исключение withStatementTimeout: долгий запрос проходит под коротким порогом пула', async () => {
    await expect(
      withStatementTimeout(
        short,
        5_000,
        (tx) => tx.$executeRaw`SELECT pg_sleep(0.8)`,
      ),
    ).resolves.toBe(1);
    expect(errorLog).not.toHaveBeenCalled();
  });

  it('SET LOCAL не протекает: после исключения все соединения пула снова с коротким порогом', async () => {
    await withStatementTimeout(short, 5_000, async (tx) => {
      const [row] = await tx.$queryRaw<
        { statement_timeout: string }[]
      >`SHOW statement_timeout`;
      expect(row.statement_timeout).toBe('5s');
    });
    // max пула — 15; параллельные SHOW разбирают в том числе соединение,
    // на котором только что шла транзакция с SET LOCAL.
    expect(await sessionLimits(short, 15)).toEqual(['300ms']);
    const err = await rejection(short.$executeRaw`SELECT pg_sleep(1)`);
    expect(isStatementTimeout(err)).toBe(true);
  });
});
