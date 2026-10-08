// prisma-exception.filter.ts — глобальный фильтр, который не даёт «сырой»
// Prisma-ошибке (с именами таблиц/колонок/SQL-фрагментами в message) уйти
// клиенту в 500-ответе. Ключевая проверка: ответ клиенту НИКОГДА не содержит
// exception.message — только заранее заданные русские фразы. Внутреннее
// сообщение уходит исключительно в this.logger (проверяем это отдельно).
import { Prisma } from '@prisma/client';
import {
  GenericExceptionFilter,
  PrismaExceptionFilter,
} from './prisma-exception.filter';
import { HttpException, HttpStatus, ArgumentsHost } from '@nestjs/common';

function makeHost(url = '/api/notes') {
  const json = jest.fn();
  const res = { status: jest.fn(() => ({ json })) };
  const req = { url };
  const host = {
    switchToHttp: () => ({
      getResponse: () => res,
      getRequest: () => req,
    }),
  } as unknown as ArgumentsHost;
  return { host, res, json };
}

function knownError(code: string, message: string) {
  return new Prisma.PrismaClientKnownRequestError(message, {
    code,
    clientVersion: '5.0.0',
  });
}

describe('PrismaExceptionFilter', () => {
  it('P2002 (unique constraint) → 409, без внутреннего сообщения в теле ответа', () => {
    const filter = new PrismaExceptionFilter();
    const { host, res, json } = makeHost();
    const secretMessage =
      'Unique constraint failed on the fields: (`userId`,`schemaId`) table `UserSchemaNote`';
    filter.catch(knownError('P2002', secretMessage), host);

    expect(res.status).toHaveBeenCalledWith(HttpStatus.CONFLICT);
    expect(json).toHaveBeenCalledWith({
      statusCode: 409,
      error: 'Conflict',
      message: 'Запись уже существует',
    });
    // Внутреннее сообщение (имена таблиц/полей) не должно попасть в JSON.
    const sentBody = json.mock.calls[0][0];
    expect(JSON.stringify(sentBody)).not.toContain('UserSchemaNote');
    expect(JSON.stringify(sentBody)).not.toContain('userId');
  });

  it('P2025 (record not found) → 404', () => {
    const filter = new PrismaExceptionFilter();
    const { host, res, json } = makeHost();
    filter.catch(
      knownError(
        'P2025',
        'An operation failed because it depends on one or more records that were required but not found.',
      ),
      host,
    );

    expect(res.status).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
    expect(json).toHaveBeenCalledWith({
      statusCode: 404,
      error: 'Not Found',
      message: 'Запись не найдена',
    });
  });

  it('P2003 (foreign key violation) → 400', () => {
    const filter = new PrismaExceptionFilter();
    const { host, res, json } = makeHost();
    filter.catch(
      knownError(
        'P2003',
        'Foreign key constraint failed on the field: `userId`',
      ),
      host,
    );

    expect(res.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(json).toHaveBeenCalledWith({
      statusCode: 400,
      error: 'Bad Request',
      message: 'Связанная запись отсутствует',
    });
  });

  it('неизвестный код известной Prisma-ошибки (например P2014) → 500 с generic-сообщением, БЕЗ утечки message', () => {
    const filter = new PrismaExceptionFilter();
    const { host, res, json } = makeHost();
    const secretMessage =
      'The change you are trying to make would violate the required relation "User_UserSchemaNote" between the `User` and `UserSchemaNote` models.';
    filter.catch(knownError('P2014', secretMessage), host);

    expect(res.status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    const sentBody = json.mock.calls[0][0];
    expect(sentBody).toEqual({
      statusCode: 500,
      error: 'Internal Server Error',
      message: 'Внутренняя ошибка сервера',
    });
    expect(JSON.stringify(sentBody)).not.toContain('UserSchemaNote');
  });

  it('PrismaClientValidationError → 400, без утечки message в тело', () => {
    const filter = new PrismaExceptionFilter();
    const { host, res, json } = makeHost();
    const secretMessage =
      'Argument `where` of type UserWhereUniqueInput needs at least one of `id`, `email`.';
    const err = new Prisma.PrismaClientValidationError(secretMessage, {
      clientVersion: '5.0.0',
    });
    filter.catch(err, host);

    expect(res.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    const sentBody = json.mock.calls[0][0];
    expect(sentBody).toEqual({
      statusCode: 400,
      error: 'Bad Request',
      message: 'Неверный формат данных',
    });
    expect(JSON.stringify(sentBody)).not.toContain('UserWhereUniqueInput');
  });

  it('логирует полное внутреннее сообщение ВТОРЫМ аргументом (stdout), клиенту не отдаёт', () => {
    const filter = new PrismaExceptionFilter();
    const logSpy = jest
      .spyOn(
        (filter as unknown as { logger: { error: (...a: unknown[]) => void } })
          .logger,
        'error',
      )
      .mockImplementation(() => undefined);
    const { host, json } = makeHost('/api/secret-path');
    const secretMessage = 'internal detail: column "ssn" does not exist';
    filter.catch(knownError('P2002', secretMessage), host);

    // Первый аргумент уходит в ALERT-канал: путь и код, без message (D1).
    const [first, second] = logSpy.mock.calls[0] as [string, string];
    expect(first).toContain('/api/secret-path');
    expect(first).toContain('P2002');
    expect(first).not.toContain(secretMessage);
    expect(second).toBe(secretMessage);
    expect(JSON.stringify(json.mock.calls[0][0])).not.toContain('ssn');
  });

  // D1 (аудит 2026-10): первый аргумент logger.error уходит админу в DM и на
  // почту. Раньше туда ехали сырой req.url (токены) и exception.message
  // (у ValidationError — полный args с открытым текстом).
  describe('D1: первый аргумент (ALERT-канал) не содержит секретов', () => {
    const TOKEN = 'Zk3Qp9xLmN2vB7tYhR4sWc8UaE1dGj';

    function firstArg(
      run: (f: PrismaExceptionFilter, host: ArgumentsHost) => void,
      url: string,
    ): string {
      const filter = new PrismaExceptionFilter();
      const logSpy = jest
        .spyOn(
          (
            filter as unknown as {
              logger: { error: (...a: unknown[]) => void };
            }
          ).logger,
          'error',
        )
        .mockImplementation(() => undefined);
      run(filter, makeHost(url).host);
      return logSpy.mock.calls[0][0] as string;
    }

    it('?token= / ?code=&state= срезаются', () => {
      const first = firstArg(
        (f, h) => f.catch(knownError('P2002', 'x'), h),
        '/api/auth/email/callback?token=SECRETTOKEN&code=AUTHCODE&state=ST',
      );
      expect(first).not.toMatch(/SECRETTOKEN|AUTHCODE|state=/);
      expect(first).toContain('/api/auth/email/callback');
    });

    it('токен в сегменте пути (by-token / ics) маскируется', () => {
      const a = firstArg(
        (f, h) => f.catch(knownError('P2025', 'x'), h),
        `/api/booking/by-token/${TOKEN}`,
      );
      const b = firstArg(
        (f, h) => f.catch(knownError('P2025', 'x'), h),
        `/api/booking/ics/${TOKEN}`,
      );
      expect(a).not.toContain(TOKEN);
      expect(b).not.toContain(TOKEN);
      expect(a).toContain('<token>');
    });

    it('PrismaClientValidationError: args с открытым текстом не в первом аргументе', () => {
      const first = firstArg(
        (f, h) =>
          f.catch(
            new Prisma.PrismaClientValidationError(
              'Invalid `prisma.note.create()`: data: { text: "я не хочу жить" }',
              { clientVersion: '5.0.0' },
            ),
            h,
          ),
        '/api/notes',
      );
      expect(first).not.toContain('не хочу жить');
      expect(first).toContain('PrismaClientValidationError');
    });

    it('GenericExceptionFilter: URL и message не в первом аргументе', () => {
      const filter = new GenericExceptionFilter();
      const logSpy = jest
        .spyOn(
          (
            filter as unknown as {
              logger: { error: (...a: unknown[]) => void };
            }
          ).logger,
          'error',
        )
        .mockImplementation(() => undefined);
      const err = new TypeError('boom: user text leaked');
      filter.catch(
        err,
        makeHost(`/api/booking/by-token/${TOKEN}?code=AUTHCODE`).host,
      );
      const [first, second] = logSpy.mock.calls[0] as [string, string];
      expect(first).not.toMatch(/AUTHCODE|user text leaked/);
      expect(first).not.toContain(TOKEN);
      expect(first).toContain('TypeError');
      expect(second).toContain('boom: user text leaked');
    });
  });

  it('req.url отсутствует → не падает, использует "?" вместо краша', () => {
    const filter = new PrismaExceptionFilter();
    const json = jest.fn();
    const res = { status: jest.fn(() => ({ json })) };
    const host = {
      switchToHttp: () => ({ getResponse: () => res, getRequest: () => ({}) }),
    } as unknown as ArgumentsHost;

    expect(() => filter.catch(knownError('P2002', 'x'), host)).not.toThrow();
  });
});

describe('GenericExceptionFilter', () => {
  it('HttpException — пропускается как есть (статус и тело сохраняются)', () => {
    const filter = new GenericExceptionFilter();
    const { host, res, json } = makeHost();
    const httpErr = new HttpException(
      { statusCode: 403, error: 'Forbidden', message: 'нет доступа' },
      HttpStatus.FORBIDDEN,
    );
    filter.catch(httpErr, host);

    expect(res.status).toHaveBeenCalledWith(HttpStatus.FORBIDDEN);
    expect(json).toHaveBeenCalledWith({
      statusCode: 403,
      error: 'Forbidden',
      message: 'нет доступа',
    });
  });

  it('неизвестное исключение (TypeError) → 500 generic-сообщение, message/stack НЕ утекают в ответ', () => {
    const filter = new GenericExceptionFilter();
    const { host, res, json } = makeHost();
    const secret = new TypeError(
      'Cannot read properties of undefined (reading "encryptionKeyForColumn")',
    );
    filter.catch(secret, host);

    expect(res.status).toHaveBeenCalledWith(500);
    const sentBody = json.mock.calls[0][0];
    expect(sentBody).toEqual({
      statusCode: 500,
      error: 'Internal Server Error',
      message: 'Внутренняя ошибка сервера',
    });
    expect(JSON.stringify(sentBody)).not.toContain('encryptionKeyForColumn');
  });

  it('логирует message и stack неизвестной ошибки, но клиенту не отдаёт', () => {
    const filter = new GenericExceptionFilter();
    const logSpy = jest
      .spyOn(
        (filter as unknown as { logger: { error: (...a: unknown[]) => void } })
          .logger,
        'error',
      )
      .mockImplementation(() => undefined);
    const { host, json } = makeHost('/api/x');
    const secret = new Error('boom: leaked internal detail');
    filter.catch(secret, host);

    // message — в stack (второй аргумент, stdout), в первый (ALERT) не идёт.
    expect(logSpy).toHaveBeenCalledWith(
      expect.not.stringContaining('boom: leaked internal detail'),
      secret.stack,
    );
    expect(JSON.stringify(json.mock.calls[0][0])).not.toContain(
      'leaked internal detail',
    );
  });

  it('исключение без message/stack (например, брошена строка) — не падает', () => {
    const filter = new GenericExceptionFilter();
    const { host, res } = makeHost();
    expect(() => filter.catch('raw string throw', host)).not.toThrow();
    expect(res.status).toHaveBeenCalledWith(500);
  });

  // Аудит 2026-07-20 (L2). Ошибки express-слоя (http-errors) приходят сюда не
  // как HttpException: Nest переводит в свои исключения только SyntaxError и
  // URIError. Раньше тело сверх лимита отдавалось клиенту 500-кой и уходило
  // админу в DM как авария сервера — а меняя путь запроса, этим выжигался общий
  // бюджет алертов (ключ троттлинга AlertLogger нормализует только цифры).
  describe('L2: клиентские ошибки express-слоя (http-errors)', () => {
    /** Как их строит body-parser: expose=true + числовой status. */
    function httpError(status: number, message: string, name: string) {
      const err = new Error(message);
      err.name = name;
      Object.assign(err, { status, statusCode: status, expose: true });
      return err;
    }

    function run(exception: unknown, url = '/api/notes') {
      const filter = new GenericExceptionFilter();
      const logger = (
        filter as unknown as {
          logger: {
            error: (...a: unknown[]) => void;
            warn: (...a: unknown[]) => void;
          };
        }
      ).logger;
      const errorSpy = jest
        .spyOn(logger, 'error')
        .mockImplementation(() => undefined);
      const warnSpy = jest
        .spyOn(logger, 'warn')
        .mockImplementation(() => undefined);
      const { host, res, json } = makeHost(url);
      filter.catch(exception, host);
      return { res, json, errorSpy, warnSpy };
    }

    it('тело сверх лимита → 413, а не 500', () => {
      const { res, json } = run(
        httpError(413, 'request entity too large', 'PayloadTooLargeError'),
      );
      expect(res.status).toHaveBeenCalledWith(413);
      expect(json).toHaveBeenCalledWith({
        statusCode: 413,
        error: 'Client Error',
        message: 'Слишком большой запрос',
      });
    });

    it('неизвестная кодировка → 415', () => {
      const { res, json } = run(
        httpError(
          415,
          'unsupported charset "ISO-8859-1"',
          'UnsupportedMediaTypeError',
        ),
      );
      expect(res.status).toHaveBeenCalledWith(415);
      expect(json).toHaveBeenCalledWith({
        statusCode: 415,
        error: 'Client Error',
        message: 'Неподдерживаемый формат данных',
      });
    });

    it('клиентская ошибка НЕ уходит в канал алертов: warn, не error', () => {
      const { errorSpy, warnSpy } = run(
        httpError(413, 'request entity too large', 'PayloadTooLargeError'),
      );
      // AlertLogger переопределяет только error() — уровень и решает, увидит
      // ли владелец DM на каждое слишком длинное письмо пользователя.
      expect(errorSpy).not.toHaveBeenCalled();
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('PayloadTooLargeError'),
      );
    });

    it('сообщение ошибки и секреты пути не утекают ни клиенту, ни в alert-строку', () => {
      const { json, warnSpy } = run(
        httpError(
          413,
          'request entity too large: limit 262144',
          'PayloadTooLargeError',
        ),
        '/api/booking/by-token/Zk3Qp9xLmN2vB7tYhR4sWc8UaE1dGj?code=AUTHCODE',
      );
      const body = JSON.stringify(json.mock.calls[0][0]);
      expect(body).not.toContain('262144');
      expect(body).not.toContain('entity');
      const logged = warnSpy.mock.calls[0][0] as string;
      expect(logged).not.toContain('AUTHCODE');
      expect(logged).not.toContain('Zk3Qp9xLmN2vB7tYhR4sWc8UaE1dGj');
      expect(logged).toContain('<token>');
    });

    it('4xx без известного текста → нейтральное сообщение', () => {
      const { res, json } = run(
        httpError(400, 'request aborted', 'BadRequestError'),
      );
      expect(res.status).toHaveBeenCalledWith(400);
      expect(json).toHaveBeenCalledWith({
        statusCode: 400,
        error: 'Client Error',
        message: 'Некорректный запрос',
      });
    });

    // КОНТРОЛЬНЫЕ ОБРАЗЦЫ (правило №15 п.2): послабление не должно быть шире,
    // чем нужно. Признак — `expose === true`, его ставит только http-errors.
    it('контроль: ошибка исходящего HTTP-клиента со статусом 404 остаётся аварией (500 + alert)', () => {
      // У AxiosError есть числовой `.status`, но нет `expose`. Чужой 404 от
      // Telegram/Resend — наша авария, и она обязана разбудить владельца.
      const axiosLike = new Error('Request failed with status code 404');
      axiosLike.name = 'AxiosError';
      Object.assign(axiosLike, { status: 404, statusCode: 404 });

      const { res, errorSpy, warnSpy } = run(axiosLike);
      expect(res.status).toHaveBeenCalledWith(500);
      expect(errorSpy).toHaveBeenCalled();
      expect(warnSpy).not.toHaveBeenCalled();
    });

    it('контроль: http-errors с 5xx (expose=false) остаётся аварией', () => {
      const err = new Error('boom');
      err.name = 'InternalServerError';
      Object.assign(err, { status: 500, statusCode: 500, expose: false });

      const { res, errorSpy } = run(err);
      expect(res.status).toHaveBeenCalledWith(500);
      expect(errorSpy).toHaveBeenCalled();
    });

    it('контроль: expose=true без числового статуса остаётся аварией', () => {
      const err = new Error('weird');
      Object.assign(err, { expose: true });

      const { res, errorSpy } = run(err);
      expect(res.status).toHaveBeenCalledWith(500);
      expect(errorSpy).toHaveBeenCalled();
    });
  });
});
