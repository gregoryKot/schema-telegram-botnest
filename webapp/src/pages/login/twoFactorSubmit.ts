import { humanizeThrown, readHumanError } from '../../../../shared/src/api/humanizeError';

// Обмен вызова 2FA + кода на сессию (POST /api/auth/2fa/challenge). Исходов
// три, и экран обязан их различать: сессия; вызов протух — код вводить
// бесполезно, нужен новый вход (`reason: 'challenge_expired'` от сервера,
// `src/auth/totp-challenge.ts`, аудит 2026-10); прочий отказ — текст для экрана.
export type TwoFactorOutcome =
  | { kind: 'ok'; accessToken: string; expiresIn: number }
  | { kind: 'expired' }
  | { kind: 'error'; message: string };

export const CHALLENGE_EXPIRED = 'challenge_expired';

export async function submitTwoFactorCode(apiBase: string, challengeToken: string, code: string): Promise<TwoFactorOutcome> {
  try {
    const res = await fetch(`${apiBase}/api/auth/2fa/challenge`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', 'x-requested-with': 'webapp' },
      body: JSON.stringify({ challengeToken, code }),
    });
    if (!res.ok) {
      // 401 без причины — «Invalid 2FA code»; лимит и авария — свой текст, не «Неверный код».
      const err = await readHumanError(res, 'Неверный код');
      return err.reason === CHALLENGE_EXPIRED ? { kind: 'expired' } : { kind: 'error', message: err.message };
    }
    const { accessToken, expiresIn } = await res.json() as { accessToken: string; expiresIn: number };
    return { kind: 'ok', accessToken, expiresIn };
  } catch (err) {
    return { kind: 'error', message: humanizeThrown(err, 'Не получилось войти') };
  }
}
