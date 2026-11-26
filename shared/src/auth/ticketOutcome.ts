// Чем кончился опрос билета — одна развилка на хук входа (useLoginTicket) и на
// обмен кода передачи сессии (webapp/src/pages/install/useHandoffExchange.ts).
//
// `totp_required`: билет подтверждён, но у аккаунта включён второй фактор.
// Сессии в ответе нет — её выдаст экран `/auth/2fa` после верного кода, тот же,
// куда приводит вход через VK ID и Яндекс ID.
import type { PolledTicket } from './loginTicketApi';

export type PollOutcome = 'session' | 'totp' | 'denied' | 'expired' | 'pending';

export interface PollHandlers {
  session: (accessToken: string, expiresIn: number) => void;
  /** По умолчанию — переход на экран второго фактора. */
  totp?: (challengeToken: string) => void;
}

export function totpChallengeUrl(challengeToken: string): string {
  return `/auth/2fa?token=${encodeURIComponent(challengeToken)}`;
}

/** Полный переход: экран 2FA сам читает вызов из адреса и стирает его. */
export function openTotpChallenge(challengeToken: string): void {
  window.location.assign(totpChallengeUrl(challengeToken));
}

/** Разобрать ответ опроса и отдать сессию или вызов 2FA тому, кто их ждёт. */
export function settlePoll(res: PolledTicket, on: PollHandlers): PollOutcome {
  if (res.status === 'linked' && res.accessToken) {
    on.session(res.accessToken, res.expiresIn ?? 900);
    return 'session';
  }
  if (res.status === 'totp_required' && res.challengeToken) {
    (on.totp ?? openTotpChallenge)(res.challengeToken);
    return 'totp';
  }
  if (res.status === 'denied' || res.status === 'expired') return res.status;
  return 'pending';
}
