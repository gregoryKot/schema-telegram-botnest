import type { ArgumentsHost, HttpException } from '@nestjs/common';
import type { Response } from 'express';

// Ответ на HttpException в GenericExceptionFilter — в той же форме тела, что
// у штатного фильтра Nest (BaseExceptionFilter): объект как есть, строка —
// `{ statusCode, message }`.
//
// Найдено починкой «сырой текст сервера на экранах входа» (аудит 2026-10):
// исключения, созданные строкой (`ThrottlerException` у каждого 429, 410 у
// старой ручки `become-therapist`), уходили голой JSON-строкой. Фронтовый
// разбор (`shared/src/api/readErrorBody.ts`) ищет `message` в объекте и такое
// тело принимал за «не-JSON»: текст сервера до экрана не доходил, а экран 2FA
// на лимит отвечал «Неверный код».
export function httpExceptionBody(exception: HttpException): object {
  const body: unknown = exception.getResponse();
  return body !== null && typeof body === 'object'
    ? body
    : { statusCode: exception.getStatus(), message: String(body) };
}

export function replyHttpException(
  host: ArgumentsHost,
  exception: HttpException,
): Response {
  const res = host.switchToHttp().getResponse<Response>();
  return res.status(exception.getStatus()).json(httpExceptionBody(exception));
}
