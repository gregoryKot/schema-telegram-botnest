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
    const path = req.url ?? '?';

    // Always log the full internal message — admin gets the alert via
    // AlertLogger and we keep the trail in case we need to debug.
    this.logger.error(`Prisma error on ${path}: ${exception.message}`);

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
    this.logger.error(
      `Unhandled error on ${req.url ?? '?'}: ${err?.message ?? String(exception)}`,
      err?.stack,
    );
    host.switchToHttp().getResponse<Response>().status(500).json({
      statusCode: 500,
      error: 'Internal Server Error',
      message: 'Внутренняя ошибка сервера',
    });
  }
}
