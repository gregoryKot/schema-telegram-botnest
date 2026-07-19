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

  it('логирует полное внутреннее сообщение (для отладки/алертов), но не отправляет его клиенту', () => {
    const filter = new PrismaExceptionFilter();
    const logSpy = jest
      .spyOn(
        (filter as unknown as { logger: { error: (s: string) => void } })
          .logger,
        'error',
      )
      .mockImplementation(() => undefined);
    const { host, json } = makeHost('/api/secret-path');
    const secretMessage = 'internal detail: column "ssn" does not exist';
    filter.catch(knownError('P2002', secretMessage), host);

    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining(secretMessage));
    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining('/api/secret-path'),
    );
    expect(JSON.stringify(json.mock.calls[0][0])).not.toContain('ssn');
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

    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining('boom: leaked internal detail'),
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
});
