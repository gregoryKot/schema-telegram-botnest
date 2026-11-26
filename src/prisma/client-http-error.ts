import { HttpException } from '@nestjs/common';

// Клиентские ошибки express-слоя (http-errors): тело больше лимита, неизвестная
// кодировка, оборванный запрос. Их ловит GenericExceptionFilter
// (prisma-exception.filter.ts) и отвечает своим статусом и своим текстом.
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
// 404 от Telegram или Postbox остаётся нашей аварией (контроль — в спеке).
const CLIENT_ERROR_MESSAGES: Record<number, string> = {
  413: 'Слишком большой запрос',
  415: 'Неподдерживаемый формат данных',
};

export interface ClientHttpError {
  status: number;
  /** Класс исходной ошибки — для лога (сообщение в лог не идёт). */
  name: string;
  /** Наш текст для клиента, не сырой текст body-parser. */
  message: string;
}

export function clientHttpError(
  exception: unknown,
): ClientHttpError | undefined {
  const source = unwrapNestHttpError(exception);
  if (!(source instanceof Error)) return undefined;
  const e = source as Error & { expose?: unknown; status?: unknown };
  if (e.expose !== true) return undefined;
  if (typeof e.status !== 'number' || e.status < 400 || e.status >= 500)
    return undefined;
  const message = CLIENT_ERROR_MESSAGES[e.status] ?? 'Некорректный запрос';
  return { status: e.status, name: e.name, message };
}

// До Nest 12.4 http-errors приходили в фильтр сырыми. С 12.4
// (nestjs/nest#18213) `ExpressAdapter.mapException` сам заворачивает их:
// `new HttpException(error.message, error.statusCode, { cause: error })` —
// клиент получал бы «request entity too large» (#1027). Обёртку узнаём по
// совпадению текста с `cause`: прикладной HttpException со своим текстом идёт
// как есть, даже если в `cause` у него лежит http-error.
function unwrapNestHttpError(exception: unknown): unknown {
  if (!(exception instanceof HttpException)) return exception;
  const { cause } = exception;
  return cause instanceof Error && cause.message === exception.message
    ? cause
    : undefined;
}
