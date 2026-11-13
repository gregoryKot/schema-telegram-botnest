// Подтверждение кодом 2FA перед привязкой и отвязкой способов входа (S12,
// аудит 2026-11; бэкенд — `src/auth/step-up.ts`, `src/auth/totp-attempts.ts`).
// У аккаунта с включённым TOTP ручки привязки отвечают 403
// `{reason:'totp_required'}`, пока в запросе нет заголовка `x-totp-code`
// (6 цифр или резервный код); 429 `{reason:'totp_locked', retryAfter}` — много
// неверных кодов, дальше принимается только резервный. Аккаунту без 2FA сервер
// этих ответов не шлёт — для него запрос проходит как раньше.
//
// Здесь — часть без React: разбор ответа, заголовок и тексты (правило №3).
// Окно ввода и повтор запроса — `webapp/src/components/stepUp/`.
import { TOTP_REQUIRED_REASON } from '../account/deleteAccountTotp';
import type { Tr } from '../account/accountLinkText';

export const STEP_UP_HEADER = 'x-totp-code';
export const TOTP_LOCKED_REASON = 'totp_locked';

export type StepUpVerdict =
  /** Ответ не про код — отдать вызывающему как есть (успех или другая ошибка). */
  | { kind: 'pass' }
  /** Нужен код (или присланный не подошёл). */
  | { kind: 'code_required' }
  /** Код из приложения на паузе; резервный принимается. */
  | { kind: 'locked'; retryAfterS: number | null };

interface StepUpBody {
  reason?: unknown;
  retryAfter?: unknown;
}

// Тело читаем с копии: ответ «pass» вызывающий разберёт сам.
async function bodyOf(res: Response): Promise<StepUpBody | null> {
  try {
    const src = typeof res.clone === 'function' ? res.clone() : res;
    const parsed: unknown = await src.json();
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

export async function readStepUpVerdict(res: Response): Promise<StepUpVerdict> {
  if (res.status !== 403 && res.status !== 429) return { kind: 'pass' };
  const body = await bodyOf(res);
  if (res.status === 403 && body?.reason === TOTP_REQUIRED_REASON) {
    return { kind: 'code_required' };
  }
  if (res.status === 429 && body?.reason === TOTP_LOCKED_REASON) {
    const s = body.retryAfter;
    return {
      kind: 'locked',
      retryAfterS: typeof s === 'number' && s > 0 ? s : null,
    };
  }
  return { kind: 'pass' };
}

/** Заголовок с кодом — только когда код есть (первый запрос идёт без него). */
export function stepUpHeader(code?: string): Record<string, string> {
  return code ? { [STEP_UP_HEADER]: code } : {};
}

/** «через 40 мин» / «через 7 ч» — сколько ещё код из приложения на паузе. */
export function lockedFor(retryAfterS: number | null): string {
  if (!retryAfterS) return '';
  const min = Math.ceil(retryAfterS / 60);
  return min < 90 ? `через ${min} мин` : `через ${Math.ceil(min / 60)} ч`;
}

export interface StepUpCopy {
  title: string;
  lead: string;
  leadRecovery: string;
  wrong: string;
  locked: (retryAfterS: number | null) => string;
}

export function buildStepUpText(tr: Tr): StepUpCopy {
  return {
    title: tr('Подтверди, что это ты', 'Подтвердите, что это вы'),
    lead: tr(
      'У тебя включена двухфакторная защита: способ входа меняется только с кодом. Введи код из приложения-аутентификатора.',
      'У вас включена двухфакторная защита: способ входа меняется только с кодом. Введите код из приложения-аутентификатора.',
    ),
    leadRecovery: tr(
      'У тебя включена двухфакторная защита: способ входа меняется только с кодом. Введи один из резервных кодов — каждый срабатывает один раз.',
      'У вас включена двухфакторная защита: способ входа меняется только с кодом. Введите один из резервных кодов — каждый срабатывает один раз.',
    ),
    wrong: tr(
      'Код не подошёл. Проверь его и попробуй ещё раз.',
      'Код не подошёл. Проверьте его и попробуйте ещё раз.',
    ),
    locked: (s) => {
      const when = lockedFor(s);
      return tr(
        `Слишком много неверных кодов подряд — код из приложения сейчас не принимается. Введи резервный код или попробуй ${when || 'позже'}.`,
        `Слишком много неверных кодов подряд — код из приложения сейчас не принимается. Введите резервный код или попробуйте ${when || 'позже'}.`,
      );
    },
  };
}
