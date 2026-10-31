import { HttpStatusError } from '../../apiClient';
import {
  HUMAN,
  isNetworkError,
} from '../../../../shared/src/api/humanizeError';

// Причина отказа сохранения концептуализации — текстом для строки статуса
// (SaveStatusLine, проп errorText; находка #880). До этого хук показывал
// message ошибки как есть: «Failed to fetch» и английский текст ValidationPipe
// доходили до экрана. Правило и проверка — из shared/src/api/humanizeError.ts:
// русский текст сервера проходит (его писали для человека), служебное
// заменяется. Тексты свои, а не shared: там безличные, здесь — с обращением
// через tr(), обе формы (правило ты/вы).

type Tr = (ty: string, vy: string) => string;

export function conceptSaveErrorText(err: unknown, tr: Tr): string {
  if (isNetworkError(err) || isAbort(err)) {
    return tr(
      'Нет связи. Проверь подключение и попробуй ещё раз.',
      'Нет связи. Проверьте подключение и попробуйте ещё раз.',
    );
  }
  if (err instanceof HttpStatusError) {
    if (err.status === 413) {
      return tr(
        'Текст слишком длинный — сервер его не принял. Сократи записи и попробуй ещё раз.',
        'Текст слишком длинный — сервер его не принял. Сократите записи и попробуйте ещё раз.',
      );
    }
    if (err.status >= 500) {
      return tr(
        'Ошибка сервера. Попробуй позже.',
        'Ошибка сервера. Попробуйте позже.',
      );
    }
    if (HUMAN.test(err.message)) return err.message;
  }
  return 'Не удалось сохранить';
}

// Таймаут fetchWithTimeout (apiClient) — AbortError: ответа не было, как и при
// обрыве сети; shared-проверка знает только TypeError движка.
function isAbort(err: unknown): boolean {
  return err instanceof DOMException && err.name === 'AbortError';
}
