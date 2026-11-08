// Адрес экрана 2FA несёт два секрета: `token` (вызов второго фактора) и
// `ticket` — код билета входа, когда вход начат в приложении
// (`finishOAuthRedirect`, src/auth/auth-flow.service.ts). Читаем их один раз
// и сразу стираем из адресной строки и истории (S21, аудит 2026-11 — как
// токен брони в BookingPaidPage). После кода с билетом путь — на сверку
// `/auth/confirm`: раньше экран вёл на /today, и приложение, начавшее вход,
// ждало до истечения билета (FIX_PLAN 1.5).
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

export function afterChallengePath(ticket: string): string {
  return ticket ? `/auth/confirm?code=${encodeURIComponent(ticket)}` : '/today';
}

export function useChallengeAddress(): { challengeToken: string; afterLogin: string } {
  const [params] = useSearchParams();
  const [read] = useState(() => ({
    challengeToken: params.get('token') ?? '',
    afterLogin: afterChallengePath(params.get('ticket') ?? ''),
  }));
  useEffect(() => {
    if (window.location.search) window.history.replaceState(window.history.state, '', window.location.pathname);
  }, []);
  return read;
}
