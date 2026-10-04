// Второй фактор перед удалением аккаунта (бэкенд: src/api/account-delete.controller.ts,
// B-13 аудита 2026-10). Если у аккаунта включён TOTP, DELETE /api/user без
// верного кода отвечает 403 с reason='totp_required' — по нему экран показывает
// поле кода и повторяет запрос уже с ним. Общее для сайта и мини-аппа
// (правило №3): определение ошибки и тексты — здесь, не в двух копиях.
//
// Все строки с обращением живут ВНУТРИ tr(): имя параметра обязано остаться
// ровно `tr` (на него настроены гейты check-second-person/check-address-form).
import type { Tr } from './accountLinkText';

/** Машиночитаемая причина 403 (совпадает с TOTP_REQUIRED на бэкенде). */
export const TOTP_REQUIRED_REASON = 'totp_required';

/**
 * Ошибка — «нужен код 2FA»? Читает `status`/`reason` с обоих клиентов:
 * `ApiError` сайта и `HttpStatusError` мини-аппа несут их полями.
 */
export function isTotpRequiredError(err: unknown): boolean {
  if (typeof err !== 'object' || err === null) return false;
  const e = err as { status?: unknown; reason?: unknown };
  return e.status === 403 && e.reason === TOTP_REQUIRED_REASON;
}

export type DeleteAttempt =
  /** Аккаунт удалён. */
  | 'deleted'
  /** Сервер просит код, а мы его не слали — показать поле. */
  | 'need_code'
  /** Код слали, но он не подошёл — показать «не подошёл». */
  | 'wrong_code'
  /** Любой другой сбой (сеть, 5xx). */
  | 'failed';

/** Одна попытка удаления; исход различает «нужен код» и «код не подошёл». */
export async function attemptDeleteAccount(
  deleteAllUserData: (code?: string) => Promise<void>,
  code?: string,
): Promise<DeleteAttempt> {
  const sent = code?.trim() || undefined;
  try {
    await deleteAllUserData(sent);
    return 'deleted';
  } catch (err) {
    if (!isTotpRequiredError(err)) return 'failed';
    return sent ? 'wrong_code' : 'need_code';
  }
}

export interface DeleteTotpCopy {
  label: string;
  placeholder: string;
  wrong: string;
}

export function buildDeleteTotpText(tr: Tr): DeleteTotpCopy {
  return {
    label: tr(
      'У тебя включена двухфакторная защита. Введи код из приложения-аутентификатора или резервный код — без него удалить аккаунт нельзя',
      'У вас включена двухфакторная защита. Введите код из приложения-аутентификатора или резервный код — без него удалить аккаунт нельзя',
    ),
    placeholder: '123456',
    wrong: tr(
      'Код не подошёл. Проверь его и попробуй ещё раз',
      'Код не подошёл. Проверьте его и попробуйте ещё раз',
    ),
  };
}
