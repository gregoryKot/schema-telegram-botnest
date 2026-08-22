import { useEffect, useRef } from 'react';
import { flushSync } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/authContext';
import { parseTelegramAuthResult } from './telegramAuthResult';

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? '';

// Handles the redirect from oauth.telegram.org after Telegram Login Widget auth.
//
// Симптом 2026-08-21: «первый вход падал, второй проходил» — oauth.telegram.org
// возвращает данные ТРЕМЯ способами (hash-фрагмент, query tgAuthResult,
// плоский query id+hash), а страница читала только hash. Разбор всех трёх
// форматов — telegramAuthResult.ts (чистая функция, тест отдельно от React).
//
// Три исхода ответа /api/auth/telegram/widget: success (токен, домой или в
// мини-апп — см. ниже), TOTP (/auth/2fa), merge (/account/merge).
export function TelegramWidgetCallback() {
  const { setAccessToken } = useAuth();
  const navigate = useNavigate();
  // Стражит от повторного запуска эффекта — раньше history.replaceState
  // стирал URL ДО fetch, второй прогон читал уже пустой URL (тот же симптом).
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    void (async () => {
      try {
        // Разобрать данные Telegram по всем трём форматам возврата.
        const outcome = parseTelegramAuthResult(window.location.hash, window.location.search);
        if (outcome.kind === 'none') {
          navigate('/auth/error?reason=telegram_no_data', { replace: true });
          return;
        }
        if (outcome.kind === 'error') {
          navigate('/auth/error?reason=telegram_decode_error', { replace: true });
          return;
        }

        // POST на widget-эндпоинт (тот же, что у инлайн-виджета)
        const res = await fetch(`${API_BASE}/api/auth/telegram/widget`, {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            'x-requested-with': 'webapp',
          },
          body: JSON.stringify(outcome.fields),
        });

        // Чистим адрес ТОЛЬКО ПОСЛЕ ответа (данные уже в outcome.fields) —
        // чистка до fetch теряла auth-данные при перезагрузке во время ожидания.
        window.history.replaceState(null, '', '/auth/telegram');

        if (!res.ok) {
          const body = await res.json().catch(() => ({})) as { message?: string };
          const reason = body.message ?? `http_${res.status}`;
          navigate(`/auth/error?reason=${encodeURIComponent(reason)}`, { replace: true });
          return;
        }

        const data = await res.json() as {
          accessToken?: string;
          expiresIn?: number;
          totp?: boolean;
          challengeToken?: string;
          merge?: boolean;
          mergeToken?: string;
          summary?: Record<string, number>;
          otherDisplay?: string;
          provider?: string;
        };

        if (data.totp && data.challengeToken) {
          navigate(`/auth/2fa?token=${encodeURIComponent(data.challengeToken)}`, { replace: true });
          return;
        }

        if (data.merge && data.mergeToken) {
          const p = new URLSearchParams({
            token: data.mergeToken,
            summary: JSON.stringify(data.summary ?? {}),
            provider: data.provider ?? 'telegram',
            name: data.otherDisplay ?? '',
          });
          navigate(`/account/merge?${p.toString()}`, { replace: true });
          return;
        }

        if (data.accessToken) {
          const returnTo = sessionStorage.getItem('auth_return_to') ?? '/today';
          sessionStorage.removeItem('auth_return_to');
          flushSync(() => setAccessToken(data.accessToken!, data.expiresIn ?? 900));
          // returnTo может вести на мини-апп (/app/…) — у сайта нет такого
          // роута, нужен полный переход (симметрично AuthCallback.tsx).
          if (returnTo.startsWith('/app')) {
            window.location.replace(returnTo);
            return;
          }
          navigate(returnTo, { replace: true });
          return;
        }

        navigate('/auth/error?reason=telegram_unexpected_response', { replace: true });
      } catch {
        navigate('/auth/error?reason=telegram_failed', { replace: true });
      }
    })();
  }, [navigate, setAccessToken]);

  return (
    <div className="loader-center">
      <div className="spinner" />
    </div>
  );
}
