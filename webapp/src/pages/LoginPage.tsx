import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/authContext';
import { getHost } from '../../../shared/src/host';
import { useAuthFailureReport } from '../../../shared/src/host/authFailureReport';
import { reportClientError } from '../api';
import { LoginProviderButtons } from './login/LoginProviderButtons';
import { LoginHero } from './login/LoginHero';
import { LoginEmailForm } from './login/LoginEmailForm';
import { TelegramRetry } from './login/TelegramRetry';
import { exchangeErrorText } from './login/exchangeError';
import { humanizeThrown } from '../../../shared/src/api/humanizeError';
import { hasAuthSeen } from '../../../shared/src/auth/authSeen';
import { useTr } from '../utils/addressForm';
import { useLoginConsentMark } from '../hooks/useLoginConsentMark';
import '../styles/auth-login.css';

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? '';

export function LoginPage() {
  const { isAuthenticated, setAccessToken } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const tr = useTr();
  useLoginConsentMark();
  // В5: после провала OAuth AuthCallback уводит сюда с ?error=no_token (читаем один раз).
  const [error, setError] = useState<string | null>(() =>
    new URLSearchParams(location.search).get('error') === 'no_token'
      ? tr(
          'Вход не получился: окно входа закрылось раньше времени. Попробуй ещё раз',
          'Вход не получился: окно входа закрылось раньше времени. Попробуйте ещё раз',
        )
      : null,
  );
  const isTelegramContext = !!getHost().sessionExchange();

  useEffect(() => {
    if (isAuthenticated) navigate('/today', { replace: true });
  }, [isAuthenticated, navigate]);

  const [miniAppLoading, setMiniAppLoading] = useState(false);
  // Сломанный вход обязан быть слышен нам, а не только виден пользователю
  // (инцидент 2026-08-08). Парная правка к AppErrorScreen мини-аппа; отчёт
  // уходит и для обычного веб-логина.
  useAuthFailureReport(
    reportClientError,
    error
      ? {
          hostId: getHost().id,
          signaturePresent: isTelegramContext
            ? ((getHost().sessionExchange()?.body.initData as string) ?? '') !== ''
            : true,
          error,
        }
      : null,
  );
  const retryTelegramAuth = async () => {
    setMiniAppLoading(true);
    setError(null);
    try {
      const exchange = getHost().sessionExchange();
      if (!exchange) { setError('initData недоступен'); return; }
      const res = await fetch(exchange.path, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(exchange.body),
      });
      if (!res.ok) { setError(await exchangeErrorText(res)); return; }
      const { accessToken, expiresIn } = await res.json() as { accessToken: string; expiresIn: number };
      setAccessToken(accessToken, expiresIn);
      navigate('/today', { replace: true });
    } catch (e) {
      setError(humanizeThrown(e, String(e)));
    } finally {
      setMiniAppLoading(false);
    }
  };

  if (isTelegramContext) {
    return <TelegramRetry loading={miniAppLoading} error={error} onRetry={retryTelegramAuth} />;
  }

  return (
    <div className="light-lock al-root">
      <LoginHero />
      <main className="al-side">
        <div className="al-form">
          <div className="ds-eyebrow">Вход</div>
          <h1 className="al-title">Всё по схеме</h1>
          {/* Новичку и человеку с истёкшей сессией нужно сказать разное
              (парная правка к LoginScreen мини-аппа, правило №3). */}
          <p className="al-sub">
            {hasAuthSeen()
              ? 'Вход устарел — данные на месте, нужно войти заново'
              : 'Войдите, чтобы продолжить. Telegram даёт тот же аккаунт, что в боте и мини-аппе'}
          </p>

          <LoginProviderButtons
            onSession={(token, expiresIn) => {
              setAccessToken(token, expiresIn);
              navigate('/today', { replace: true });
            }}
          />

          {/* Прежний путь через oauth.telegram.org остался вторым способом:
              не требует установленного Telegram, но при первом визите просит
              телефон и код. */}
          <button
            className="al-linkbtn"
            onClick={() => { window.location.href = `${API_BASE}/api/auth/telegram/redirect`; }}
          >
            Войти через Telegram другим способом
          </button>

          <LoginEmailForm setError={setError} />

          {error && <p className="al-error">{error}</p>}

          <p className="al-note">
            Нажимая «Войти», вы подтверждаете, что вам исполнилось 18 лет, и даёте согласие
            на обработку персональных данных — включая сведения о психоэмоциональном состоянии
            (дневники, ответы на опросники), которые вы добровольно вносите, —
            в соответствии с{' '}
            <a href="/privacy" target="_blank">Политикой конфиденциальности</a>
          </p>

          {/* Проект бесплатный — ненавязчивая точка поддержки на первом экране */}
          <p className="al-note">
            Проект бесплатный <a href="/donate">поддержать</a>
          </p>
        </div>
      </main>
    </div>
  );
}
