import type { LoggerService } from '@nestjs/common';

// Аудит 2026-10 (I6): обработчика `unhandledRejection` не было. Node 22 по
// умолчанию роняет процесс со стеком в stderr — а в stderr админ не смотрит:
// алерт уходит только через AlertLogger (Logger.error → DM/e-mail). Поэтому
// обработчик пишет ошибку через Nest Logger, даёт алерту время уйти и только
// потом завершает процесс: «молча жить с неизвестным состоянием» хуже
// перезапуска (entrypoint Amvera поднимет процесс заново).
//
// В лог идёт ТОЛЬКО message и stack. Сам `reason` не сериализуется: у
// ошибок HTTP-клиентов (axios и т. п.) внутри лежат config/request с
// телом запроса, то есть с заметками и дневником пользователя (правило №7),
// токенами бота и заголовками авторизации.

/** Сколько ждём отправки DM перед выходом: уведомление асинхронное. */
export const UNHANDLED_REJECTION_EXIT_DELAY_MS = 2000;
const MAX_MESSAGE_LENGTH = 300;

/** Текст причины без тела запроса: message для Error, тип для остального. */
export function describeRejection(reason: unknown): {
  message: string;
  stack?: string;
} {
  if (reason instanceof Error) {
    return {
      message: reason.message.slice(0, MAX_MESSAGE_LENGTH),
      stack: reason.stack,
    };
  }
  // Не-Error (строка, объект, число): объект может нести что угодно — не
  // сериализуем, пишем только тип; строка — это уже текст автора ошибки.
  if (typeof reason === 'string') {
    return { message: reason.slice(0, MAX_MESSAGE_LENGTH) };
  }
  return { message: `non-Error rejection (${typeof reason})` };
}

export function registerUnhandledRejectionHandler(
  logger: LoggerService,
  exit: (code: number) => void = (code) => process.exit(code),
  setTimer: (fn: () => void, ms: number) => unknown = setTimeout,
): (reason: unknown) => void {
  const handler = (reason: unknown) => {
    const { message, stack } = describeRejection(reason);
    logger.error(`unhandledRejection: ${message}`, stack);
    setTimer(() => exit(1), UNHANDLED_REJECTION_EXIT_DELAY_MS);
  };
  process.on('unhandledRejection', handler);
  return handler;
}
