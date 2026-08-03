/**
 * PrismaExceptionFilter — единственный файл каталога `src/filters`, и до сих
 * пор он был без теста, хотя стоит на границе «база → пользователь».
 *
 * Два класса бага, ради которых фильтр существует и которые тест держит:
 *
 * 1. Утечка структуры БД. Текст ошибки Prisma содержит имена таблиц и колонок
 *    («Unique constraint failed on the fields: (`userId`,`date`)»). Без
 *    фильтра Nest отдаёт его пятисоткой наружу — бесплатная карта схемы для
 *    любого, кто умеет вызывать конфликт. Поэтому ассерт не только на статус,
 *    но и на то, что исходного текста в ответе НЕТ.
 * 2. Неверный код ответа. Конфликт по unique-констрейнту — это 409, а не 500:
 *    клиент по 500 будет ретраить запрос, который никогда не пройдёт.
 */

import { ArgumentsHost, HttpStatus, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaExceptionFilter } from './prisma-exception.filter';

interface Captured {
  status?: number;
  body?: unknown;
}

function makeHost(): { host: ArgumentsHost; captured: Captured } {
  const captured: Captured = {};
  const response = {
    status(code: number) {
      captured.status = code;
      return this;
    },
    json(body: unknown) {
      captured.body = body;
      return this;
    },
  };
  const host = {
    switchToHttp: () => ({ getResponse: () => response }),
  } as unknown as ArgumentsHost;
  return { host, captured };
}

function prismaError(code: string, message: string) {
  return new Prisma.PrismaClientKnownRequestError(message, {
    code,
    clientVersion: 'test',
  });
}

describe('PrismaExceptionFilter', () => {
  const filter = new PrismaExceptionFilter();

  it.each([
    ['P2002', HttpStatus.CONFLICT, 'Resource already exists'],
    ['P2025', HttpStatus.NOT_FOUND, 'Resource not found'],
    ['P2003', HttpStatus.BAD_REQUEST, 'Referenced resource does not exist'],
    ['P2014', HttpStatus.BAD_REQUEST, 'Invalid relation'],
  ])('код %s → HTTP %i с нейтральным текстом', (code, status, message) => {
    const { host, captured } = makeHost();

    filter.catch(prismaError(code, 'Unique constraint failed on `Rating`'), host);

    expect(captured.status).toBe(status);
    expect(captured.body).toEqual({ statusCode: status, message });
  });

  it('не отдаёт наружу текст ошибки Prisma — в нём имена таблиц и колонок', () => {
    const { host, captured } = makeHost();
    const leaky =
      'Unique constraint failed on the fields: (`userId`,`date`) of table `Rating`';

    filter.catch(prismaError('P2002', leaky), host);

    expect(JSON.stringify(captured.body)).not.toContain('Rating');
    expect(JSON.stringify(captured.body)).not.toContain('userId');
  });

  it('незнакомый код: 500 без подробностей, но с записью в лог', () => {
    // Ответ обязан молчать, лог — наоборот, сохранить код и текст: иначе
    // новый класс ошибок Prisma будет уходить пятисотками без следов, и
    // причину придётся искать по жалобам пользователей.
    const { host, captured } = makeHost();
    const spy = jest.spyOn(Logger.prototype, 'error').mockImplementation();

    filter.catch(prismaError('P2028', 'Transaction API error: timed out'), host);

    expect(captured.status).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(captured.body).toEqual({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Database error',
    });
    expect(spy).toHaveBeenCalledWith(
      'Unhandled Prisma error P2028',
      'Transaction API error: timed out',
    );
    spy.mockRestore();
  });

  it('известный код не пишет ошибку в лог — иначе штатный конфликт шумит как авария', () => {
    const { host } = makeHost();
    const spy = jest.spyOn(Logger.prototype, 'error').mockImplementation();

    filter.catch(prismaError('P2002', 'duplicate'), host);

    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});
