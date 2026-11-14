import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { canRetryEmailConsume, consumeEmailToken, emailConsumeNextPath } from './consumeEmailToken';
import { ServiceLoading } from '../service/ServiceLoading';
import { AuthErrorView } from '../AuthErrorPage';

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? '';

// Страница, куда ведёт ссылка привязки почты из письма (см. consumeEmailToken.ts).
// Сама отправляет POST и уводит дальше; ошибки живут на экранах назначения
// (/auth/error отчитывается наверх через useAuthFailureReport — правило №14).
// Сеть или сбой сервера ссылку не тратят: экран «Нет связи» с «Повторить» —
// здесь же, токен только в памяти страницы, в адрес и историю он не попадает.
export function EmailTokenConsume({ token }: { token: string }) {
  const navigate = useNavigate();
  // Токен одноразовый: повторный запуск эффекта (StrictMode) сжёг бы его вторым POST-ом.
  const started = useRef(false);
  const [retryReason, setRetryReason] = useState<string | null>(null);

  const consume = useCallback(async () => {
    setRetryReason(null);
    const outcome = await consumeEmailToken(API_BASE, token);
    if (outcome.kind === 'error' && canRetryEmailConsume(outcome.reason)) return setRetryReason(outcome.reason);
    navigate(emailConsumeNextPath(outcome), { replace: true });
  }, [token, navigate]);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    // Токен не должен остаться в адресной строке и попасть в Referer.
    window.history.replaceState(null, '', '/auth/callback');
    void consume();
  }, [consume]);

  if (retryReason) return <AuthErrorView reason={retryReason} onRetry={() => void consume()} />;
  return <ServiceLoading label="Привязываем почту…" />;
}
