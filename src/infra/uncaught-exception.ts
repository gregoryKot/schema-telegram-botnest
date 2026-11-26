import type { LoggerService } from '@nestjs/common';
import {
  describeRejection,
  UNHANDLED_REJECTION_EXIT_DELAY_MS,
} from './unhandled-rejection';

// Аудит 2026-10 (I6, вторая половина): синхронный throw в таймере или
// колбэке (`uncaughtException`) ронял процесс со стеком в stderr мимо
// AlertLogger — владелец DM не получал, entrypoint молча перезапускал.
// Путь тот же, что у `unhandledRejection` (./unhandled-rejection.ts):
// Logger.error → AlertLogger → DM, пауза на отправку алерта, exit(1).
//
// В лог идёт ТОЛЬКО message и stack, сам объект ошибки не сериализуется:
// у ошибок HTTP-клиентов внутри config/request с телом запроса (правило №7).
//
// Выход планируется один раз: шторм исключений (например, 'error' у
// EventEmitter без слушателя) пишет каждое в лог — повторы DM гасит троттл
// AlertLogger, — но не плодит таймеры и не откладывает выход.

/** Текст исключения: как у reject-а, но подпись не-Error — «exception». */
export function describeException(err: unknown): {
  message: string;
  stack?: string;
} {
  if (err instanceof Error || typeof err === 'string') {
    return describeRejection(err);
  }
  return { message: `non-Error exception (${typeof err})` };
}

export function registerUncaughtExceptionHandler(
  logger: LoggerService,
  exit: (code: number) => void = (code) => process.exit(code),
  setTimer: (fn: () => void, ms: number) => unknown = setTimeout,
): (err: unknown) => void {
  let exitScheduled = false;
  const handler = (err: unknown) => {
    const { message, stack } = describeException(err);
    logger.error(`uncaughtException: ${message}`, stack);
    if (exitScheduled) return;
    exitScheduled = true;
    setTimer(() => exit(1), UNHANDLED_REJECTION_EXIT_DELAY_MS);
  };
  process.on('uncaughtException', handler);
  return handler;
}
