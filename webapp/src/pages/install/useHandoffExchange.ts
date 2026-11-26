import { useEffect, useRef } from 'react';
import { createLoginTicketApi } from '../../../../shared/src/auth/loginTicketApi';
import { openTotpChallenge, settlePoll } from '../../../../shared/src/auth/ticketOutcome';
import { useAuth } from '../../auth/authContext';
import { rememberReturnTo } from '../../auth/returnTo';
import { API_BASE } from '../../utils/apiBase';
import { readHandoffCode } from './installLogic';

// Включена 2FA: код спросит экран /auth/2fa, после него — обратно на установку.
const askCode = (token: string) => (rememberReturnTo('/install'), openTotpChallenge(token));

type Track = (action: 'handoff_ok' | 'handoff_failed') => void;

/**
 * Обмен кода передачи сессии (из внешнего браузера, куда увела кнопка в
 * мессенджере) на сессию. Фрагмент стираем при монтировании: код одноразовый,
 * но светить его в адресе незачем. Вход уже есть (куки) — код не нужен.
 */
export function useHandoffExchange(track: Track): void {
  const { isAuthenticated, isLoading, setAccessToken } = useAuth();
  const code = useRef<string | null | undefined>(undefined);
  const exchanged = useRef(false);

  useEffect(() => {
    if (code.current !== undefined) return;
    code.current = readHandoffCode(window.location.hash);
    if (window.location.hash) {
      history.replaceState(null, '', window.location.pathname + window.location.search);
    }
  }, []);

  useEffect(() => {
    if (isLoading || exchanged.current || !code.current) return;
    exchanged.current = true;
    if (isAuthenticated) return;
    createLoginTicketApi(API_BASE)
      .poll(code.current)
      .then((r) => {
        const end = settlePoll(r, { session: setAccessToken, totp: askCode });
        if (end !== 'totp') track(end === 'session' ? 'handoff_ok' : 'handoff_failed');
      })
      .catch(() => track('handoff_failed'));
  }, [isLoading, isAuthenticated, setAccessToken, track]);
}
