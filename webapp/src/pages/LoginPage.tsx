import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? '';

function isEmail(s: string) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s); }

export function LoginPage() {
  const { isAuthenticated, setAccessToken } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [showEmail, setShowEmail] = useState(false);
  const [emailValue, setEmailValue] = useState('');
  const [emailSent, setEmailSent] = useState(false);
  const [emailLoading, setEmailLoading] = useState(false);
  const isTelegramContext = !!(window as any).Telegram?.WebApp?.initData;

  useEffect(() => {
    if (isAuthenticated) navigate('/today', { replace: true });
  }, [isAuthenticated, navigate]);

  // ── Mini-app fallback ────────────────────────────────────────────────────
  const [miniAppLoading, setMiniAppLoading] = useState(false);
  const retryTelegramAuth = async () => {
    setMiniAppLoading(true);
    setError(null);
    try {
      const initData = (window as any).Telegram?.WebApp?.initData;
      if (!initData) { setError('initData недоступен'); return; }
      const res = await fetch('/api/auth/telegram/webapp', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initData }),
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

  const handleGoogle   = () => { window.location.href = `${API_BASE}/api/auth/google`; };
  const handleVk       = () => { window.location.href = `${API_BASE}/api/auth/vk`; };
  const handleTelegram = () => { window.location.href = `${API_BASE}/api/auth/telegram/redirect`; };

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
        <div style={{ fontSize: 48, marginBottom: 16 }}>🧠</div>
        <p style={{ color: 'var(--text-sub)', marginBottom: 24, textAlign: 'center' }}>
          {miniAppLoading ? 'Загрузка...' : 'Не удалось войти автоматически'}
        </p>
        {error && <p style={{ color: 'var(--accent-red)', fontSize: 13, marginBottom: 16, textAlign: 'center', maxWidth: 320 }}>{error}</p>}
        <button className="btn-outline" onClick={retryTelegramAuth} disabled={miniAppLoading}>
          Попробовать снова
        </button>
      </div>
    );
  }

  return (
    <div style={{
      flex: 1, minHeight: '100vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', padding: '24px',
      position: 'relative', overflow: 'hidden',
    }}>
      {/* Ambient blobs */}
      <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0 }}>
        <div style={{ position: 'absolute', width: 600, height: 600, borderRadius: '50%', background: 'var(--blob-1)', filter: 'blur(80px)', top: '-10%', left: '-15%' }} />
        <div style={{ position: 'absolute', width: 500, height: 500, borderRadius: '50%', background: 'var(--blob-2)', filter: 'blur(80px)', bottom: '-5%', right: '-10%' }} />
      </div>

      <div style={{ width: '100%', maxWidth: 400, position: 'relative', zIndex: 1, animation: 'fade-in 0.4s ease both' }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div style={{ width: 72, height: 72, background: 'linear-gradient(135deg, var(--accent-indigo), var(--accent))', borderRadius: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', fontSize: 36, boxShadow: '0 8px 32px rgba(124, 114, 248, 0.35)' }}>🧠</div>
          <h1 style={{ fontSize: 26, fontWeight: 700, marginBottom: 8 }}>СхемаЛаб</h1>
          <p style={{ color: 'var(--text-sub)', fontSize: 15, lineHeight: 1.5, maxWidth: 320, margin: '0 auto' }}>
            Инструмент схема-терапии для работы с мыслями, эмоциями и паттернами
          </p>
        </div>

        {/* Auth card */}
        <div className="card-elevated" style={{ padding: '28px 24px' }}>
          <p style={{ color: 'var(--text-sub)', fontSize: 13, marginBottom: 20, textAlign: 'center' }}>
            Войдите, чтобы продолжить
          </p>

          {/* Google */}
          <button className="btn-outline" onClick={handleGoogle} style={{ marginBottom: 8 }}>
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
              <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.859-3.048.859-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z" fill="#34A853"/>
              <path d="M3.964 10.71c-.18-.54-.282-1.117-.282-1.71s.102-1.17.282-1.71V4.958H.957C.347 6.173 0 7.548 0 9s.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
              <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.958L3.964 6.29C4.672 4.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
            </svg>
            Войти через Google
          </button>

          {/* VK */}
          <button className="btn-outline" onClick={handleVk} style={{ marginBottom: 12 }}>
            <span style={{ background: '#0077FF', color: 'white', borderRadius: 4, padding: '1px 6px', fontWeight: 700, fontSize: 12 }}>VK</span>
            Войти через ВКонтакте
          </button>

          {/* Divider */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '16px 0' }}>
            <div style={{ flex: 1, height: 1, background: 'var(--line)' }} />
            <span style={{ color: 'var(--text-faint)', fontSize: 12 }}>или</span>
            <div style={{ flex: 1, height: 1, background: 'var(--line)' }} />
          </div>

          {/* Telegram — redirect flow (full-page, no iframe needed) */}
          <button className="btn-outline" onClick={handleTelegram} style={{ marginBottom: 0 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm4.93 6.89l-1.68 7.92c-.12.56-.45.7-.9.43l-2.5-1.84-1.2 1.16c-.13.13-.25.25-.5.25l.18-2.55 4.63-4.18c.2-.18-.04-.27-.31-.1l-5.72 3.6-2.46-.77c-.54-.17-.55-.54.11-.8l9.58-3.69c.45-.16.85.11.69.77z" fill="#2AABEE"/>
            </svg>
            Войти через Telegram
          </button>

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
            <div style={{ marginTop: 16, padding: '14px 16px', background: 'rgba(var(--fg-rgb),0.04)', borderRadius: 10, textAlign: 'center' }}>
              <div style={{ fontSize: 28, marginBottom: 8 }}>✉️</div>
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
                autoFocus
                placeholder="your@email.com"
                value={emailValue}
                onChange={e => setEmailValue(e.target.value)}
                style={{ width: '100%', padding: '11px 14px', fontSize: 14, border: '1.5px solid var(--line)', borderRadius: 10, background: 'rgba(var(--fg-rgb),0.04)', color: 'var(--text)', fontFamily: 'inherit', boxSizing: 'border-box', outline: 'none', marginBottom: 8 }}
              />
              <button
                type="submit"
                disabled={emailLoading}
                style={{ width: '100%', padding: '11px', fontSize: 14, fontWeight: 600, background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 10, cursor: emailLoading ? 'default' : 'pointer', opacity: emailLoading ? 0.7 : 1 }}
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
          Нажимая «Войти», вы подтверждаете согласие на обработку персональных данных
          в соответствии с{' '}
          <a href="/privacy" target="_blank" style={{ color: 'var(--text-faint)', textDecoration: 'underline' }}>
            Политикой конфиденциальности
          </a>
        </p>
      </div>

      <style>{`@keyframes fade-in { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: none; } }`}</style>
    </div>
  );
}
