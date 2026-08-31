import { useEffect, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/authContext';
import { getHost } from '../../../shared/src/host';
import { AuthFailureHelp } from '../../../shared/src/components/AuthFailureHelp';
import { useAuthFailureReport } from '../../../shared/src/host/authFailureReport';
import { reportClientError } from '../api';
import { MMIcon } from '../components/modeMapIcons';
import { LoginProviderButtons } from './login/LoginProviderButtons';
import { hasAuthSeen } from '../../../shared/src/auth/authSeen';
import { useTr } from '../utils/addressForm';

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? '';

function isEmail(s: string) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s); }

export function LoginPage() {
  const { isAuthenticated, setAccessToken } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const tr = useTr();
  // В5 (аудит 2026-08): AuthCallback.tsx после провала OAuth (окно входа
  // закрылось раньше времени, провайдер не вернул токен) уводит сюда с
  // ?error=no_token — раньше /login эту query никогда не читал, и человек
  // просто видел форму входа заново, без единого слова о том, что что-то
  // сорвалось. Ленивый инициализатор вместо useEffect+setState — читаем
  // query один раз при монтировании, без лишнего рендера
  // (react-hooks/set-state-in-effect).
  const [error, setError] = useState<string | null>(() =>
    new URLSearchParams(location.search).get('error') === 'no_token'
      ? tr(
          'Вход не получился: окно входа закрылось раньше времени. Попробуй ещё раз',
          'Вход не получился: окно входа закрылось раньше времени. Попробуйте ещё раз',
        )
      : null,
  );
  const [showEmail, setShowEmail] = useState(false);
  const [emailValue, setEmailValue] = useState('');
  const [emailSent, setEmailSent] = useState(false);
  const [emailLoading, setEmailLoading] = useState(false);
  const isTelegramContext = !!getHost().sessionExchange();
  const emailInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isAuthenticated) navigate('/today', { replace: true });
  }, [isAuthenticated, navigate]);

  useEffect(() => {
    if (showEmail && !emailSent) emailInputRef.current?.focus();
  }, [showEmail, emailSent]);

  // ── Mini-app fallback ────────────────────────────────────────────────────
  const [miniAppLoading, setMiniAppLoading] = useState(false);
  // Сломанный вход внутри мессенджера обязан быть слышен нам, а не только
  // виден пользователю (инцидент 2026-08-08: пять суток вход не работал у
  // всех пользователей Telegram, и телеметрия молчала — она была только у
  // крашей ErrorBoundary). Парная правка к AppErrorScreen мини-аппа. В5:
  // отчёт теперь уходит и для обычного веб-логина (не только внутри
  // мессенджера) — молчаливый провал OAuth был не виден нам точно так же.
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
      if (!res.ok) {
        const body = await res.text().catch(() => '');
        setError(`Ошибка ${res.status}: ${body.slice(0, 120)}`);
        return;
      }
      const { accessToken, expiresIn } = await res.json() as { accessToken: string; expiresIn: number };
      setAccessToken(accessToken, expiresIn);
      navigate('/today', { replace: true });
    } catch (e) {
      setError(String(e));
    } finally {
      setMiniAppLoading(false);
    }
  };


  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isEmail(emailValue)) { setError('Введи корректный email'); return; }
    setEmailLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/auth/email/link`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-requested-with': 'webapp' },
        body: JSON.stringify({ email: emailValue }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message ?? `Ошибка ${res.status}`);
      setEmailSent(true);
    } catch (e) {
      setError((e as Error).message || 'Не удалось отправить письмо');
    } finally {
      setEmailLoading(false);
    }
  };

  // Inside Telegram but auto-auth failed – show minimal retry UI
  if (isTelegramContext) {
    return (
      <div style={{ flex: 1, minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <p style={{ color: 'var(--text-sub)', marginBottom: 24, textAlign: 'center' }}>{miniAppLoading ? 'Загрузка...' : 'Не удалось войти автоматически'}</p>
        {error && <p style={{ color: 'var(--accent-red)', fontSize: 13, marginBottom: 16, textAlign: 'center', maxWidth: 320 }}>{error}</p>}
        <button className="btn-outline" onClick={retryTelegramAuth} disabled={miniAppLoading}>Попробовать снова</button>
        {/* Экран обязан назвать, кому написать (пара к AppErrorScreen, правило №3). */}
        <div style={{ marginTop: 24, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-8)', textAlign: 'center', maxWidth: 320 }}><AuthFailureHelp hostId={getHost().id} /></div>
      </div>
    );
  }

  return (
    <div style={{
      flex: 1, minHeight: '100vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', padding: '24px',
      position: 'relative', overflow: 'hidden',
    }}>
      {/* Ambient blobs удалены: --blob-1/--blob-2 не определены нигде в
         webapp/shared — рисовалась пустота, а blur(80px) x2 считался
         честно каждый кадр (см. index.css/.mobile-nav). */}
      <div style={{ width: '100%', maxWidth: 400, position: 'relative', zIndex: 1, animation: 'fade-in 0.4s ease both' }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div style={{ width: 72, height: 72, background: 'linear-gradient(135deg, var(--accent-indigo), var(--accent))', borderRadius: 'var(--r-20)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', color: '#fff', boxShadow: '0 8px 32px rgba(124, 114, 248, 0.35)' }}><MMIcon name="compass" size={34} stroke={1.6} /></div>
          <h1 style={{ fontSize: 26, fontWeight: 700, marginBottom: 8 }}>Всё по схеме</h1>
          <p style={{ color: 'var(--text-sub)', fontSize: 15, lineHeight: 1.5, maxWidth: 320, margin: '0 auto' }}>
            Инструмент схема-терапии для работы с мыслями, эмоциями и паттернами
          </p>
        </div>

        {/* Auth card */}
        <div className="card-elevated" style={{ padding: '28px 24px' }}>
          {/* Новичку и человеку с истёкшей сессией нужно сказать разное:
              «Войдите, чтобы продолжить» второму — молчание о случившемся
              (парная правка к LoginScreen мини-аппа, правило №3). */}
          <p style={{ color: 'var(--text-sub)', fontSize: 13, marginBottom: 20, textAlign: 'center' }}>
            {hasAuthSeen()
              ? 'Вход устарел — данные на месте, нужно войти заново'
              : 'Войдите, чтобы продолжить'}
          </p>

          <LoginProviderButtons
            onSession={(token, expiresIn) => {
              setAccessToken(token, expiresIn);
              navigate('/today', { replace: true });
            }}
          />

          {/* Прежний путь через oauth.telegram.org остался вторым способом:
              он не требует установленного Telegram, но при первом визите в
              браузер просит телефон и код — отсюда «получается со второй
              попытки», из-за которого диплинк и стал основным. */}
          <p style={{ textAlign: 'center', marginBottom: 12 }}>
            <button
              onClick={() => { window.location.href = `${API_BASE}/api/auth/telegram/redirect`; }}
              style={{ background: 'none', border: 'none', color: 'var(--text-faint)', fontSize: 12, cursor: 'pointer', textDecoration: 'underline', padding: 0 }}
            >
              Войти через Telegram другим способом
            </button>
          </p>

          {/* Email magic link */}
          {!showEmail ? (
            <p style={{ textAlign: 'center', marginTop: 12 }}>
              <button
                onClick={() => { setShowEmail(true); setError(null); }}
                style={{ background: 'none', border: 'none', color: 'var(--text-faint)', fontSize: 12, cursor: 'pointer', textDecoration: 'underline', padding: 0 }}
              >
                Войти по email
              </button>
            </p>
          ) : emailSent ? (
            <div style={{ marginTop: 16, padding: '14px 16px', background: 'rgba(var(--fg-rgb),0.04)', borderRadius: 'var(--r-10)', textAlign: 'center' }}>
              <p style={{ fontSize: 14, color: 'var(--text)', fontWeight: 600, margin: '0 0 4px' }}>Письмо отправлено</p>
              <p style={{ fontSize: 13, color: 'var(--text-sub)', margin: 0 }}>Проверь почту и перейди по ссылке — она действует 30 минут</p>
              <button
                onClick={() => { setEmailSent(false); setEmailValue(''); }}
                style={{ background: 'none', border: 'none', color: 'var(--text-faint)', fontSize: 12, cursor: 'pointer', marginTop: 10, textDecoration: 'underline', padding: 0 }}
              >
                Ввести другой email
              </button>
            </div>
          ) : (
            <form onSubmit={handleEmailSubmit} style={{ marginTop: 16 }}>
              <input
                type="email"
                ref={emailInputRef}
                placeholder="your@email.com"
                value={emailValue}
                onChange={e => setEmailValue(e.target.value)}
                style={{ width: '100%', padding: '11px 14px', fontSize: 14, border: '1.5px solid var(--line)', borderRadius: 'var(--r-10)', background: 'rgba(var(--fg-rgb),0.04)', color: 'var(--text)', fontFamily: 'inherit', boxSizing: 'border-box', outline: 'none', marginBottom: 8 }}
              />
              <button
                type="submit"
                disabled={emailLoading}
                style={{ width: '100%', padding: '11px', fontSize: 14, fontWeight: 600, background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 'var(--r-10)', cursor: emailLoading ? 'default' : 'pointer', opacity: emailLoading ? 0.7 : 1 }}
              >
                {emailLoading ? 'Отправляем…' : 'Отправить ссылку'}
              </button>
              <button
                type="button"
                onClick={() => { setShowEmail(false); setError(null); }}
                style={{ background: 'none', border: 'none', color: 'var(--text-faint)', fontSize: 12, cursor: 'pointer', textDecoration: 'underline', padding: '6px 0 0', width: '100%' }}
              >
                Отмена
              </button>
            </form>
          )}

          {error && (
            <p style={{ color: 'var(--accent-red)', fontSize: 13, marginTop: 12, textAlign: 'center' }}>{error}</p>
          )}

          <p style={{ textAlign: 'center', marginTop: 18 }}>
            <a href="/auth/recovery" style={{ color: 'var(--text-faint)', fontSize: 12, textDecoration: 'underline' }}>
              Потерял доступ ко всем способам входа?
            </a>
          </p>
        </div>

        {/* Consent note */}
        <p style={{ color: 'var(--text-faint)', fontSize: 12, textAlign: 'center', marginTop: 20, lineHeight: 1.7 }}>
          Нажимая «Войти», вы подтверждаете, что вам исполнилось 18 лет, и даёте согласие
          на обработку персональных данных — включая сведения о психоэмоциональном состоянии
          (дневники, ответы на опросники), которые вы добровольно вносите, —
          в соответствии с{' '}
          <a href="/privacy" target="_blank" style={{ color: 'var(--text-faint)', textDecoration: 'underline' }}>
            Политикой конфиденциальности
          </a>
        </p>

        {/* Проект бесплатный — ненавязчивая точка поддержки на первом экране */}
        <p style={{ color: 'var(--text-faint)', fontSize: 12, textAlign: 'center', marginTop: 14 }}>
          Проект бесплатный{' '}
          <a href="/donate" style={{ color: 'var(--accent)', textDecoration: 'none' }}>поддержать</a>
        </p>
      </div>

      <style>{`@keyframes fade-in { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: none; } }`}</style>
    </div>
  );
}
