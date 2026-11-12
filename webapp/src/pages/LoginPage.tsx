import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/authContext';
import { getHost } from '../../../shared/src/host';
import { useAuthFailureReport } from '../../../shared/src/host/authFailureReport';
import { reportClientError } from '../api';
import { LoginProviderButtons } from './login/LoginProviderButtons';
import { LoginShell } from './login/LoginShell';
import { PaperAlert } from '../components/paper/PaperAlert';
import { LoginEmailForm } from './login/LoginEmailForm';
import { LoginFormerNote } from './login/LoginFormerNote';
import { TelegramRetry } from './login/TelegramRetry';
import { LoginConsentNote } from './login/LoginConsentNote';
import { exchangeErrorText, exchangeThrownText } from './login/exchangeError';
import { hasAuthSeen } from '../../../shared/src/auth/authSeen';
import { ACCOUNT_DELETED_TEXT, useAccountDeletedNotice } from '../../../shared/src/account/accountDeletion';
import { useLoginConsentMark } from '../hooks/useLoginConsentMark';
import { useAfterLoginPath } from '../auth/returnTo';
import '../styles/auth-login.css';

export function LoginPage() {
  const { isAuthenticated, setAccessToken } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const afterLogin = useAfterLoginPath(); // адрес, с которого увели на вход (E14)
  useLoginConsentMark();
  // В5: после провала OAuth AuthCallback уводит сюда с ?error=no_token (читаем один раз).
  const [error, setError] = useState<string | null>(() =>
    new URLSearchParams(location.search).get('error') === 'no_token'
      ? // Безлично: /login вне AddressFormProvider, формы до входа нет (как DonatePage).
        'Вход не получился: окно входа закрылось раньше времени. Можно попробовать ещё раз.'
      : null,
  );
  // Сбой — у того, к чему относится, выше сгиба (b26: на 390 стоял ниже согласия): у кнопок или у почты.
  const [errorAt, setErrorAt] = useState<'providers' | 'email'>('providers');
  const setEmailError = (e: string | null) => { setErrorAt('email'); setError(e); };
  const errorAlert = error ? <PaperAlert title={error} sign="cup" className="al-alert" /> : null;
  const isTelegramContext = !!getHost().sessionExchange();
  const deleted = useAccountDeletedNotice(); // сразу после удаления — не «вход устарел» (К2)

  useEffect(() => {
    if (isAuthenticated) navigate(afterLogin(), { replace: true });
  }, [isAuthenticated, navigate, afterLogin]);

  const [miniAppLoading, setMiniAppLoading] = useState(false);
  const enter = (accessToken: string, expiresIn: number) => {
    setAccessToken(accessToken, expiresIn);
    navigate(afterLogin(), { replace: true });
  };
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
      enter(accessToken, expiresIn);
    } catch (e) {
      setError(exchangeThrownText(e));
    } finally {
      setMiniAppLoading(false);
    }
  };

  if (isTelegramContext) {
    return <TelegramRetry loading={miniAppLoading} error={error} onRetry={retryTelegramAuth} />;
  }

  return (
    <LoginShell>
      <div className="ds-eyebrow">Вход</div>
      <h1 className="al-title">Всё по схеме</h1>
      {/* Новичку и человеку с истёкшей сессией нужно сказать разное
          (парная правка к LoginScreen мини-аппа, правило №3). */}
      <p className="al-sub" role={deleted ? 'status' : undefined}>
        {deleted ? ACCOUNT_DELETED_TEXT : hasAuthSeen()
          ? 'Вход устарел — данные на месте, нужно войти заново'
          : 'Войдите, чтобы продолжить'}
      </p>

      {errorAt === 'providers' && errorAlert}
      <LoginProviderButtons onSession={enter} />

      <LoginEmailForm setError={setEmailError} error={errorAt === 'email' ? errorAlert : null} />
      <LoginFormerNote />

      <LoginConsentNote />

      {/* Проект бесплатный — ненавязчивая точка поддержки на первом экране */}
      <p className="al-note">
        Проект бесплатный <a href="/donate">поддержать</a>
      </p>
    </LoginShell>
  );
}
