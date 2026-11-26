// Тексты отказа POST /api/therapy/join — один набор на оба фронтенда и на оба
// пути (код в «Мой терапевт» и ссылка-приглашение), правило №3.
// - 409 { reason: 'already_connected' }: у клиента уже есть активная связь с
//   другим терапевтом — «Неверный код» тут врёт: код верный, мешает
//   действующее подключение.
// - QA 2026-11 (З1): обрыв сети, 429 и 500 тоже выглядели как «Код не
//   подошёл», и человек шёл просить у терапевта новый код, хотя старый
//   рабочий. Сбой по дороге говорит о себе сам; «код не подошёл» — только
//   когда сервер отказал по коду (400/404).
// Формулировки без рода (правило «Род читателя»): «есть подключение», а не
// «подключён».
import {
  isNetworkError,
  SERVER_DOWN_TEXT,
  TOO_MANY_TEXT,
} from '../api/humanizeError';

type Tr = (ty: string, vy: string) => string;

export function isAlreadyConnectedError(err: unknown): boolean {
  if (typeof err !== 'object' || err === null) return false;
  const e = err as { status?: unknown; reason?: unknown };
  return e.status === 409 && e.reason === 'already_connected';
}

export function joinTherapyErrorText(err: unknown, tr: Tr): string | null {
  if (!isAlreadyConnectedError(err)) return null;
  return tr(
    'У тебя уже есть подключение к терапевту. Сначала отключись в настройках, потом принимай новый код',
    'У вас уже есть подключение к терапевту. Сначала отключитесь в настройках, затем примите новый код',
  );
}

function statusOf(err: unknown): number | null {
  const s = (err as { status?: unknown } | null)?.status;
  return typeof s === 'number' ? s : null;
}

// Таймаут запроса (AbortController в fetchWithTimeout обоих клиентов) — тот
// же обрыв связи, что TypeError от fetch.
function isConnectionLost(err: unknown): boolean {
  if (isNetworkError(err)) return true;
  const name = (err as { name?: unknown } | null)?.name;
  return name === 'AbortError' || name === 'TimeoutError';
}

/**
 * Сбой не из-за кода или ссылки: связь, лимит попыток, авария сервера.
 * null — сервер ответил по существу, текст выбирает вызывающий.
 */
export function joinTransportErrorText(err: unknown, tr: Tr): string | null {
  if (isConnectionLost(err))
    return tr(
      'Нет связи с сервером. Попробуй ещё раз, когда появится интернет',
      'Нет связи с сервером. Попробуйте ещё раз, когда появится интернет',
    );
  const status = statusOf(err);
  if (status === 429) return TOO_MANY_TEXT;
  if (status !== null && status >= 500) return SERVER_DOWN_TEXT;
  return null;
}

/** Отказ подключения по коду в «Мой терапевт»: всегда честная причина. */
export function codeJoinErrorText(err: unknown, tr: Tr): string {
  const known =
    joinTherapyErrorText(err, tr) ?? joinTransportErrorText(err, tr);
  if (known) return known;
  const status = statusOf(err);
  if (status === 400 || status === 404)
    return tr(
      'Код не подошёл. Проверь его или попроси у терапевта новый',
      'Код не подошёл. Проверьте его или попросите у терапевта новый',
    );
  return tr(
    'Не получилось подключиться. Попробуй ещё раз',
    'Не получилось подключиться. Попробуйте ещё раз',
  );
}
