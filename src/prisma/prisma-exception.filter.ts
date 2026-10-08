import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Request, Response } from 'express';
import { safeRequestPath } from './safe-request-path';

// Global filter that maps Prisma errors to friendly 4xx responses.
//
// Without this, NestJS's default exception filter returns a 500 with
// `error.message` straight from Prisma — which can include table/column
// names, query fragments, and other DB internals we'd rather not leak.
//
// We translate the most common error codes; everything else falls through
// to the default filter (Nest will return a generic 500 and the message
// goes only to our logs).
@Catch(Prisma.PrismaClientKnownRequestError, Prisma.PrismaClientValidationError)
export class PrismaExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(PrismaExceptionFilter.name);

  catch(exception: Error, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();
    const req = host.switchToHttp().getRequest<Request>();
    // Аудит 2026-10 (D1): AlertLogger шлёт админу в DM и на почту ТОЛЬКО
    // первый аргумент `.error()`. Сырой `req.url` (токены записи в пути,
    // `?token=`, OAuth `?code=&state=`) и `exception.message` (у
    // PrismaClientValidationError внутри полный `args` с открытыми колонками)
    // туда попадать не должны. Поэтому первый аргумент — маскированный путь +
    // код/класс ошибки, а полный message — вторым (только stdout; конвенция
    // H0/H6, см. client-errors.controller.ts).
    const path = safeRequestPath(req.url);
    const kind =
      exception instanceof Prisma.PrismaClientKnownRequestError
        ? exception.code
        : exception.name;
    this.logger.error(`Prisma error on ${path} (${kind})`, exception.message);

    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      switch (exception.code) {
        case 'P2002': // Unique constraint violation
          return res.status(HttpStatus.CONFLICT).json({
            statusCode: 409,
            error: 'Conflict',
            message: 'Запись уже существует',
          });
        case 'P2025': // Record not found
          return res.status(HttpStatus.NOT_FOUND).json({
            statusCode: 404,
            error: 'Not Found',
            message: 'Запись не найдена',
          });
        case 'P2003': // Foreign key violation
          return res.status(HttpStatus.BAD_REQUEST).json({
            statusCode: 400,
            error: 'Bad Request',
            message: 'Связанная запись отсутствует',
          });
      }
    }
    if (exception instanceof Prisma.PrismaClientValidationError) {
      return res.status(HttpStatus.BAD_REQUEST).json({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Неверный формат данных',
      });
    }

    // Unknown Prisma error — generic 500.
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: 500,
      error: 'Internal Server Error',
      message: 'Внутренняя ошибка сервера',
    });
  }
}

// Клиентские ошибки express-слоя (http-errors): тело больше лимита, неизвестная
// кодировка, оборванный запрос. Сюда они приходят НЕ как HttpException — Nest
// переводит в свои только SyntaxError и URIError (routes-resolver.js,
// `mapExternalException`), остальное отдаёт фильтру как есть.
//
// Аудит 2026-07-20 (L2): без этой ветки клиент получал 500 вместо 413, а
// `logger.error` будил владельца в DM. Хуже статуса был шум — ключ троттлинга
// AlertLogger нормализует только цифры, а первым аргументом идёт ПУТЬ: меняя
// его (`/api/aaa`, `/api/aab`, …), любой без авторизации выжигал общий бюджет
// алертов (15/мин на все подсистемы), и настоящая авария в это окно молчала
// (правило №14: «алерт, тонущий в шуме, — это не алерт»). Разбор лимита —
// src/infra/body-limit.ts.
//
// Признак узкий: `expose === true` ставит только http-errors. Числового
// `status` мало — он есть и у ошибок исходящих клиентов (AxiosError), а чужой
// 404 от Telegram или Resend остаётся нашей аварией (контроль — в спеке).
const CLIENT_ERROR_MESSAGES: Record<number, string> = {
  413: 'Слишком большой запрос',
  415: 'Неподдерживаемый формат данных',
};

function clientErrorStatus(exception: unknown): number | undefined {
  if (!(exception instanceof Error)) return undefined;
  const e = exception as Error & { expose?: unknown; status?: unknown };
  if (e.expose !== true) return undefined;
  return typeof e.status === 'number' && e.status >= 400 && e.status < 500
    ? e.status
    : undefined;
}

// Re-throws HttpException as-is, hides any other unhandled exception's message.
// Acts as a safety net so that a stray TypeError or raw fetch error doesn't
// leak its stack to the API client.
@Catch()
export class GenericExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GenericExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    if (exception instanceof HttpException) {
      // Nest's normal exception flow — pass through.
      const res = host.switchToHttp().getResponse<Response>();
      const body = exception.getResponse();
      return res.status(exception.getStatus()).json(body);
    }
    const req = host.switchToHttp().getRequest<Request>();
    const err = exception instanceof Error ? exception : undefined;
    // D1: первый аргумент уходит в ALERT-канал — только маскированный путь и
    // класс ошибки; message и стек — вторым (stdout), см. PrismaExceptionFilter.
    // Сырой req.url не попадает в логи ни в одной из веток ниже — трипваер
    // src/security/log-leak.invariants.spec.ts следит именно за этим.
    const path = safeRequestPath(req.url);

    const clientStatus = clientErrorStatus(exception);
    if (clientStatus !== undefined) {
      // Уровень `warn`, а не `error`: в стандартный вывод строка попадает,
      // в канал алертов (AlertLogger переопределяет только `error`) — нет.
      // Сообщение самой ошибки клиенту не отдаём и в лог не кладём.
      this.logger.warn(
        `Client error on ${path} (${err?.name ?? typeof exception}) → ${clientStatus}`,
      );
      return host
        .switchToHttp()
        .getResponse<Response>()
        .status(clientStatus)
        .json({
          statusCode: clientStatus,
          error: 'Client Error',
          message: CLIENT_ERROR_MESSAGES[clientStatus] ?? 'Некорректный запрос',
        });
    }

    this.logger.error(
      `Unhandled error on ${path} (${err?.name ?? typeof exception})`,
      err?.stack ?? err?.message ?? String(exception),
    );
    host.switchToHttp().getResponse<Response>().status(500).json({
      statusCode: 500,
      error: 'Internal Server Error',
      message: 'Внутренняя ошибка сервера',
    });
  }
}
