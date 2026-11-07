// Текст ошибки для экрана: что показать человеку, когда запрос не удался.
// Аудит 2026-10, «сырой текст сервера на экранах входа»: на экран шёл message
// как есть — «ThrottlerException: Too Many Requests», «TypeError: Failed to fetch».
// Правило одно на класс, а не на строку: русский текст сервера проходит как
// есть (его пишут для человека — проверяется НАЛИЧИЕ кириллицы, «Код 2FA не
// подошёл» человеческий), служебный английский заменяется — лимитом, аварией,
// обрывом сети или запасным текстом экрана. Тексты безличные — без «ты/вы» и рода.
import { readErrorBody, type ErrorBodyInfo } from './readErrorBody';

export const NO_CONNECTION_TEXT = 'Нет связи с сервером';
export const SERVER_DOWN_TEXT = 'Сервер не ответил. Повторить можно чуть позже';
export const TOO_MANY_TEXT =
  'Слишком много попыток подряд. Повторить можно чуть позже';
// 413 — тело больше потолка сервера (src/infra/body-limit.ts; край — карта
// режимов и концептуализация на потолке DTO). Сервер пишет «Слишком большой
// запрос» — по-русски, но не говорит, что делать, поэтому 413 — раньше текста.
export const TOO_LARGE_TEXT =
  'Текст слишком длинный — сервер его не принял. Сохранится, если сократить';

export const HUMAN = /[А-Яа-яЁё]/; // есть кириллица — текст писали для человека
// fetch отклоняется TypeError с текстом движка (Chrome, Safari, Firefox). Любой
// другой TypeError — ошибка кода, а не сети: «нет связи» на нём было бы неправдой.
const NETWORK =
  /failed to fetch|load failed|networkerror|network request failed/i;

export function isNetworkError(err: unknown): boolean {
  return err instanceof TypeError && NETWORK.test(err.message);
}

export function humanizeResponseError(
  status: number,
  message: string | undefined,
  fallback: string,
): string {
  if (status === 413) return TOO_LARGE_TEXT;
  if (message && HUMAN.test(message)) return message;
  if (status === 429) return TOO_MANY_TEXT;
  if (status >= 500) return SERVER_DOWN_TEXT;
  return fallback;
}

// Статус — полем ошибки (`ApiError` сайта, `HttpStatusError` оценки): shared
// не знает классов клиента, поэтому читает поле, а не instanceof.
function errorStatus(err: unknown): number | undefined {
  const status =
    err instanceof Error ? (err as { status?: unknown }).status : undefined;
  return typeof status === 'number' ? status : undefined;
}

export function humanizeThrown(err: unknown, fallback: string): string {
  if (isNetworkError(err)) return NO_CONNECTION_TEXT;
  const message = err instanceof Error ? err.message : '';
  const status = errorStatus(err);
  if (status !== undefined)
    return humanizeResponseError(status, message, fallback);
  return HUMAN.test(message) ? message : fallback;
}

/** Разбор неуспешного ответа (readErrorBody) с текстом, готовым для экрана;
 *  `reason` — машинный код причины, если сервер его прислал. */
export async function readHumanError(
  res: Response,
  fallback: string,
): Promise<ErrorBodyInfo> {
  const body = await readErrorBody(res);
  return {
    ...body,
    message: humanizeResponseError(res.status, body.message, fallback),
  };
}
