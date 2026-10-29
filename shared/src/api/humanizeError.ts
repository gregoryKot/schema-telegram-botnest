// Текст ошибки для экрана: что показать человеку, когда запрос не удался.
// Аудит 2026-10, находка «сырой текст сервера на экранах входа»: экраны клали
// на экран message ответа или ошибки как есть — «ThrottlerException: Too Many
// Requests», «Invalid 2FA code», «Merge failed», «TypeError: Failed to fetch».
//
// Правило одно на класс, а не на строку: русский текст сервера проходит как
// есть (его пишут для человека), а служебный английский заменяется — лимитом,
// аварией сервера, обрывом сети или запасным текстом самого экрана. Проверяется
// НАЛИЧИЕ кириллицы, а не отсутствие латиницы: «Код 2FA не подошёл» и текст с
// адресом почты — человеческие. Все тексты безличные — без «ты/вы» и рода.
import { readErrorBody, type ErrorBodyInfo } from './readErrorBody';

export const NO_CONNECTION_TEXT = 'Нет связи с сервером';
export const SERVER_DOWN_TEXT = 'Сервер не ответил. Повторить можно чуть позже';
export const TOO_MANY_TEXT =
  'Слишком много попыток подряд. Повторить можно чуть позже';

export const HUMAN = /[А-Яа-яЁё]/; // есть кириллица — текст писали для человека
// fetch отклоняется TypeError с текстом движка: Chrome — «Failed to fetch»,
// Safari — «Load failed», Firefox — «NetworkError when attempting to fetch
// resource.». Любой другой TypeError — ошибка кода, а не сети: «нет связи» на
// нём было бы неправдой.
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
  if (message && HUMAN.test(message)) return message;
  if (status === 429) return TOO_MANY_TEXT;
  if (status >= 500) return SERVER_DOWN_TEXT;
  return fallback;
}

export function humanizeThrown(err: unknown, fallback: string): string {
  if (isNetworkError(err)) return NO_CONNECTION_TEXT;
  const message = err instanceof Error ? err.message : '';
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
