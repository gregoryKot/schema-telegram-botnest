// Чем кончается опрос подтверждённого билета: сессией или вызовом 2FA.
//
// Билет входа (`login`) и передачи сессии (`handoff`) подтверждают сессией
// мини-приложения MAX, а туда входят по подписи мессенджера, без кода. Отдай
// опрос сессию сразу — второй фактор обходился бы входом на сайт через MAX.
// Поэтому аккаунту с 2FA опрос отдаёт тот же вызов, что и OAuth
// (auth-flow.service.ts): сессию выдаёт `POST /api/auth/2fa/challenge` после
// верного кода. Привязка (`link`) — не вход: её начинает уже вошедший на сайт,
// а одобрение стоит за StepUpGuard.
import type { AuthService } from '../auth.service';
import type { TotpService } from '../totp.service';
import type { TicketStatus } from './login-ticket.types';

export async function grantTicketSession(
  deps: { auth: AuthService; totp: TotpService },
  ticket: { userId: bigint; intent: string },
  ip?: string,
  userAgent?: string,
): Promise<TicketStatus> {
  const { userId } = ticket;
  if (ticket.intent !== 'link' && (await deps.totp.isEnabled(userId))) {
    return {
      status: 'totp_required',
      challengeToken: deps.auth.buildTotpChallengeToken(userId, ip, userAgent),
    };
  }
  const tokens = await deps.auth.issueTokens(userId, ip, userAgent);
  return { status: 'linked', tokens };
}
