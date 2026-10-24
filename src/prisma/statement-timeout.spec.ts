// statement-timeout.ts: разбор рубильника, распознавание таймаута по формам
// ошибок, снятым с живого Postgres (P2039 у модельного запроса, P2010 у
// сырого), и строка лога для владельца. Что лимит реально доходит до сессии и
// срабатывает — test/statement-timeout.e2e-spec.ts (джоба migrations).
import { Prisma } from '@prisma/client';
import { ENV_REGISTRY } from '../infra/env-registry.entries';
import {
  DEFAULT_STATEMENT_TIMEOUT_MS,
  MAX_STATEMENT_TIMEOUT_MS,
  isStatementTimeout,
  statementTimeoutLogLine,
  statementTimeoutMs,
  withStatementTimeout,
} from './statement-timeout';

const adapterError = (prismaCode: string, sqlstate: string) =>
  new Prisma.PrismaClientKnownRequestError(`Code: \`${sqlstate}\``, {
    code: prismaCode,
    clientVersion: '7.0.0',
    meta: { driverAdapterError: { cause: { originalCode: sqlstate } } },
  });

describe('statementTimeoutMs — рубильник DB_STATEMENT_TIMEOUT_MS', () => {
  it.each([
    [undefined, DEFAULT_STATEMENT_TIMEOUT_MS],
    ['', DEFAULT_STATEMENT_TIMEOUT_MS],
    ['15000', 15_000],
    [' 45000 ', 45_000],
    ['0', 0],
    ['-1', DEFAULT_STATEMENT_TIMEOUT_MS],
    ['30s', DEFAULT_STATEMENT_TIMEOUT_MS],
    ['abc', DEFAULT_STATEMENT_TIMEOUT_MS],
    // Потолок типа Postgres: больше — FATAL на каждом соединении, не выключение.
    ['2147483647', MAX_STATEMENT_TIMEOUT_MS],
    ['2147483648', DEFAULT_STATEMENT_TIMEOUT_MS],
    ['300000000000', DEFAULT_STATEMENT_TIMEOUT_MS],
  ])('%j → %d', (raw, expected) => {
    expect(statementTimeoutMs(raw)).toBe(expected);
  });

  it('реестр env проверяет рубильник тем же правилом, что и пул (правило №4)', () => {
    const entry = ENV_REGISTRY.find(
      (e) => e.name === 'DB_STATEMENT_TIMEOUT_MS',
    );
    expect(entry?.format('0')).toBeNull();
    expect(entry?.format('2147483647')).toBeNull();
    expect(entry?.format('2147483648')).toBe(
      'ожидалось целое число миллисекунд от 0 до 2147483647',
    );
    expect(entry?.format('30s')).toBe(
      'ожидалось целое число миллисекунд от 0 до 2147483647',
    );
  });

  it('по умолчанию — 30 с (порог, согласованный владельцем)', () => {
    expect(DEFAULT_STATEMENT_TIMEOUT_MS).toBe(30_000);
  });
});

describe('isStatementTimeout', () => {
  it('модельный запрос (P2039) и сырой (P2010) с 57014 — таймаут', () => {
    expect(isStatementTimeout(adapterError('P2039', '57014'))).toBe(true);
    expect(isStatementTimeout(adapterError('P2010', '57014'))).toBe(true);
  });

  it('ошибка голого pg с code 57014 — таймаут', () => {
    const e = Object.assign(new Error('canceling statement'), {
      code: '57014',
    });
    expect(isStatementTimeout(e)).toBe(true);
  });

  it('контроль: другие SQLSTATE и не-ошибки — не таймаут', () => {
    expect(isStatementTimeout(adapterError('P2010', '40P01'))).toBe(false);
    expect(isStatementTimeout(adapterError('P2002', '23505'))).toBe(false);
    expect(isStatementTimeout(new Error('57014'))).toBe(false);
    expect(isStatementTimeout('57014')).toBe(false);
    expect(isStatementTimeout(null)).toBe(false);
  });
});

describe('statementTimeoutLogLine — строка владельцу', () => {
  // Форма события `error` Prisma 7 — снята с живого Postgres 2026-10-22.
  const event = (call: string, at: string, code = '57014') =>
    `\nInvalid \`${call}\` invocation in\n${at}\n\n  9 const x = 1;\n→ 12 await ${call}(\nDatabase error. Code: \`${code}\`. Message: \`canceling statement due to statement timeout\``;

  it('называет порог, вызов и место в коде (путь от dist/)', () => {
    expect(
      statementTimeoutLogLine(
        event('this.prisma.rating.findMany()', '/app/dist/src/bot/x.js:12:27'),
        30_000,
      ),
    ).toBe(
      'Запрос к БД прерван: дольше statement_timeout 30 с — this.prisma.rating.findMany() (dist/src/bot/x.js:12:27)',
    );
  });

  it('порог не кратный секунде — в мс; без места вызова — без хвоста', () => {
    expect(
      statementTimeoutLogLine(
        'Raw query failed. Code: `57014`. Message: `canceling statement due to statement timeout`',
        300,
      ),
    ).toBe('Запрос к БД прерван: дольше statement_timeout 300 мс');
  });

  it('контроль: прочие ошибки Prisma — null (их логирует вызывающий)', () => {
    expect(
      statementTimeoutLogLine(
        event('prisma.user.create()', '/app/dist/a.js:1:1', '23505'),
        30_000,
      ),
    ).toBeNull();
  });
});

describe('withStatementTimeout', () => {
  it('ставит SET LOCAL через параметр и раздвигает границу транзакции Prisma', async () => {
    const executeRaw = jest.fn(async () => 1);
    const tx = { $executeRaw: executeRaw };
    const $transaction = jest.fn(
      async (fn: (t: typeof tx) => Promise<unknown>, _opts: unknown) => fn(tx),
    );
    const prisma = { $transaction } as unknown as Parameters<
      typeof withStatementTimeout
    >[0];

    await expect(
      withStatementTimeout(prisma, 120_000, async () => 'ok'),
    ).resolves.toBe('ok');
    const [strings, value] = executeRaw.mock.calls[0] as unknown as [
      TemplateStringsArray,
      string,
    ];
    expect(strings.join('?')).toContain(
      "set_config('statement_timeout', ?, true)",
    );
    expect(value).toBe('120000');
    expect($transaction.mock.calls[0][1]).toEqual({
      timeout: 125_000,
      maxWait: 10_000,
    });
  });

  it('граница транзакции Prisma не выходит за потолок setTimeout', async () => {
    const tx = { $executeRaw: jest.fn(async () => 1) };
    const $transaction = jest.fn(
      async (fn: (t: typeof tx) => Promise<unknown>, _opts: unknown) => fn(tx),
    );
    const prisma = { $transaction } as unknown as Parameters<
      typeof withStatementTimeout
    >[0];
    await withStatementTimeout(prisma, MAX_STATEMENT_TIMEOUT_MS, async () => 1);
    expect($transaction.mock.calls[0][1]).toEqual({
      timeout: MAX_STATEMENT_TIMEOUT_MS,
      maxWait: 10_000,
    });
  });

  it.each([0, -1, 1.5, MAX_STATEMENT_TIMEOUT_MS + 1])(
    'limitMs = %d — ошибка, а не тихий «без лимита»',
    (ms) => {
      const prisma = { $transaction: jest.fn() } as unknown as Parameters<
        typeof withStatementTimeout
      >[0];
      expect(() => withStatementTimeout(prisma, ms, async () => 1)).toThrow(
        'limitMs > 0',
      );
    },
  );
});
