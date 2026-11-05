import { useEffect, useRef } from 'react';
import { createLoginTicketApi } from '../../../../shared/src/auth/loginTicketApi';
import { useAuth } from '../../auth/authContext';
import { API_BASE } from '../../utils/apiBase';
import { readHandoffCode } from './installLogic';

type Track = (action: 'handoff_ok' | 'handoff_failed') => void;

/**
 * Обмен кода передачи сессии (из внешнего браузера, куда человека увела кнопка
 * в мессенджере) на сессию. Фрагмент стираем сразу при монтировании: код
 * одноразовый, но светить его в адресной строке и истории незачем. Ждём
 * окончания первичной проверки сессии: если вход уже есть (куки), код не нужен.
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
        if (r.status === 'linked' && r.accessToken) {
          setAccessToken(r.accessToken, r.expiresIn ?? 900);
          track('handoff_ok');
        } else {
          track('handoff_failed');
        }
      })
      .catch(() => track('handoff_failed'));
  }, [isLoading, isAuthenticated, setAccessToken, track]);
}
