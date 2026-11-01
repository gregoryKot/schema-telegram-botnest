import { UnauthorizedException } from '@nestjs/common';

/** Что несёт подписанный 2FA-вызов: кто прошёл первый фактор и откуда. */
export interface TotpChallenge {
  userId: bigint;
  ip: string | null;
  ua: string;
}

// Вызов 2FA живёт 5 минут. Протухший (или битый) вызов отвечает тем же 401,
// что и неверный код, поэтому `reason` — единственное, по чему экран
// `TwoFactorChallengePage` отличает «вход устарел, начать заново» от «код не
// подошёл, ввести ещё раз» (аудит 2026-10).
export const CHALLENGE_EXPIRED_REASON = 'challenge_expired';

export class ChallengeExpiredException extends UnauthorizedException {
  constructor() {
    super({
      message: 'Invalid or expired 2FA challenge token',
      reason: CHALLENGE_EXPIRED_REASON,
    });
  }
}
