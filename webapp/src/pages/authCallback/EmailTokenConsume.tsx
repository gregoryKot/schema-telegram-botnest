import { useCallback, useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/authContext';
import { canRetryEmailConsume, consumeEmailToken, emailConsumeNextPath } from './consumeEmailToken';
import { ServiceLoading } from '../service/ServiceLoading';
import { AuthErrorView } from '../AuthErrorPage';
import { takeReturnTo } from '../../auth/returnTo';
import { emailReturnPath } from '../../auth/emailReturnTo';

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? '';

// Страница, куда ведёт ссылка из письма (см. consumeEmailToken.ts). Сама
// отправляет POST и уводит дальше; ошибки живут на экранах назначения
// (/auth/error отчитывается наверх через useAuthFailureReport — правило №14).
// Сеть или сбой сервера ссылку не тратят: экран «Нет связи» с «Повторить» —
// здесь же, токен только в памяти страницы, в адрес и историю он не попадает.
export function EmailTokenConsume({ token, ticket, returnTo: linkReturnTo = null }: { token: string; ticket: string | null; returnTo?: string | null }) {
  const { setAccessToken } = useAuth();
  const navigate = useNavigate();
  // Токен одноразовый: повторный запуск эффекта (StrictMode) сжёг бы его вторым POST-ом.
  const started = useRef(false);
  const [retryReason, setRetryReason] = useState<string | null>(null);

  const consume = useCallback(async () => {
    setRetryReason(null);
    const outcome = await consumeEmailToken(API_BASE, token);
    if (outcome.kind === 'error' && canRetryEmailConsume(outcome.reason)) return setRetryReason(outcome.reason);
    let returnTo: string | null = null;
    if (outcome.kind === 'session') {
      returnTo = emailReturnPath(linkReturnTo, takeReturnTo()); // письмо открыто новой вкладкой (E14)
      // Синхронно, до navigate: иначе RequireAuth увидит «не вошёл» и уведёт на /login.
      flushSync(() => setAccessToken(outcome.accessToken, outcome.expiresIn));
      if (!ticket && returnTo?.startsWith('/app')) return window.location.replace(returnTo);
    }
    navigate(emailConsumeNextPath(outcome, ticket, returnTo), { replace: true });
  }, [token, ticket, linkReturnTo, navigate, setAccessToken]);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    // Токен не должен остаться в адресной строке и попасть в Referer.
    window.history.replaceState(null, '', '/auth/callback');
    void consume();
  }, [consume]);

  if (retryReason) return <AuthErrorView reason={retryReason} onRetry={() => void consume()} />;
  return <ServiceLoading label="Входим…" />;
}
