import { useEffect, useRef } from 'react';
import { flushSync } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/authContext';
import { consumeEmailToken, emailConsumeNextPath } from './consumeEmailToken';

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? '';

// Страница, куда ведёт ссылка из письма (см. consumeEmailToken.ts). Сама
// отправляет POST и уводит дальше; ошибки живут на экранах назначения
// (/auth/error отчитывается наверх через useAuthFailureReport — правило №14).
export function EmailTokenConsume({ token, ticket }: { token: string; ticket: string | null }) {
  const { setAccessToken } = useAuth();
  const navigate = useNavigate();
  // Токен одноразовый: повторный запуск эффекта (StrictMode) сжёг бы его вторым POST-ом.
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    // Токен не должен остаться в адресной строке и попасть в Referer.
    window.history.replaceState(null, '', '/auth/callback');
    void (async () => {
      const outcome = await consumeEmailToken(API_BASE, token);
      let returnTo: string | null = null;
      if (outcome.kind === 'session') {
        returnTo = sessionStorage.getItem('auth_return_to');
        sessionStorage.removeItem('auth_return_to');
        // Синхронно, до navigate: иначе RequireAuth увидит «не вошёл» и уведёт на /login.
        flushSync(() => setAccessToken(outcome.accessToken, outcome.expiresIn));
        if (!ticket && returnTo?.startsWith('/app')) {
          window.location.replace(returnTo);
          return;
        }
      }
      navigate(emailConsumeNextPath(outcome, ticket, returnTo), { replace: true });
    })();
  }, [token, ticket, navigate, setAccessToken]);

  return (
    <div className="loader-center" role="status" aria-live="polite">
      <div className="spinner" />
      <p style={{ marginTop: 16, color: 'var(--text-sub)', fontSize: 14 }}>
        Входим…
      </p>
    </div>
  );
}
