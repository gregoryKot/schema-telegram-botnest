// PrismaService подписывается на событие `error` Prisma и пишет владельцу одну
// строку о таймауте запроса (statement-timeout.ts). Живое событие от базы —
// test/statement-timeout.e2e-spec.ts; здесь — что подписка есть, порог берётся
// из рубильника и прочие ошибки Prisma не превращаются в лишний DM.
import { Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaService } from './prisma.service';

type ErrorHandler = (e: { message: string }) => void;

describe('PrismaService — строка о таймауте запроса', () => {
  const prevEnv = process.env.DB_STATEMENT_TIMEOUT_MS;
  let handlers: Record<string, ErrorHandler>;
  let errorLog: jest.SpyInstance;

  beforeEach(() => {
    handlers = {};
    const proto = PrismaClient.prototype as unknown as {
      $on: (event: string, cb: ErrorHandler) => void;
    };
    jest.spyOn(proto, '$on').mockImplementation((event, cb) => {
      handlers[event] = cb;
    });
    errorLog = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    if (prevEnv === undefined) delete process.env.DB_STATEMENT_TIMEOUT_MS;
    else process.env.DB_STATEMENT_TIMEOUT_MS = prevEnv;
  });

  it('57014 → одна строка с порогом из DB_STATEMENT_TIMEOUT_MS', () => {
    process.env.DB_STATEMENT_TIMEOUT_MS = '1500';
    new PrismaService();
    handlers.error({
      message:
        'Invalid `prisma.rating.findMany()` invocation in\n/app/dist/src/a.js:1:2\n\nDatabase error. Code: `57014`. Message: `canceling statement due to statement timeout`',
    });
    expect(errorLog).toHaveBeenCalledTimes(1);
    expect(errorLog.mock.calls[0][0]).toBe(
      'Запрос к БД прерван: дольше statement_timeout 1500 мс — prisma.rating.findMany() (dist/src/a.js:1:2)',
    );
  });

  it('контроль: другая ошибка Prisma — без строки (её логирует вызывающий)', () => {
    new PrismaService();
    handlers.error({ message: 'Unique constraint failed. Code: `23505`' });
    expect(errorLog.mock.calls).toEqual([]);
  });
});
