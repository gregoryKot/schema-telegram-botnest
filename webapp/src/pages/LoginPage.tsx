import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? '';
const BOT_USERNAME = (import.meta.env.VITE_BOT_USERNAME as string | undefined) ?? 'SchemaLabBot';

declare global {
  interface Window {
    onTelegramAuth?: (user: Record<string, string>) => void;
  }
}

export function LoginPage() {
  const { isAuthenticated, setAccessToken } = useAuth();
  const navigate = useNavigate();
  const telegramRef = useRef<HTMLDivElement>(null);
  const [telegramLoading, setTelegramLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isTelegramContext = !!(window as any).Telegram?.WebApp?.initData;

  useEffect(() => {
    if (isAuthenticated) navigate('/', { replace: true });
  }, [isAuthenticated, navigate]);

  const retryTelegramAuth = async () => {
    setTelegramLoading(true);
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
      navigate('/', { replace: true });
    } catch (e) {
      setError(String(e));
    } finally {
      setTelegramLoading(false);
    }
  };

  // Inject Telegram Login Widget script
  useEffect(() => {
    if (!BOT_USERNAME || !telegramRef.current) return;

    window.onTelegramAuth = async (userData) => {
      setTelegramLoading(true);
      setError(null);
      try {
        const res = await fetch(`${API_BASE}/api/auth/telegram/widget`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-requested-with': 'webapp' },
          body: JSON.stringify(userData),
          credentials: 'include',
        });
        if (!res.ok) {
          const body = await res.text().catch(() => '');
          setError(`Ошибка ${res.status}: ${body.slice(0, 200) || 'нет деталей'}`);
          return;
        }
        const { accessToken, expiresIn } = await res.json() as { accessToken: string; expiresIn: number };
        setAccessToken(accessToken, expiresIn);
        navigate('/', { replace: true });
      } catch (e) {
        setError(`Не удалось войти: ${String(e).slice(0, 150)}`);
      } finally {
        setTelegramLoading(false);
      }
    };

    const script = document.createElement('script');
    script.src = 'https://telegram.org/js/telegram-widget.js?22';
    script.async = true;
    script.setAttribute('data-telegram-login', BOT_USERNAME);
    script.setAttribute('data-size', 'large');
    script.setAttribute('data-onauth', 'onTelegramAuth(user)');
    script.setAttribute('data-request-access', 'write');
    telegramRef.current.appendChild(script);

    return () => { delete window.onTelegramAuth; };
  }, [navigate, setAccessToken]);

  const handleGoogle = () => {
    window.location.href = `${API_BASE}/api/auth/google`;
  };
  const handleVk = () => {
    window.location.href = `${API_BASE}/api/auth/vk`;
  };

  // Inside Telegram but auto-auth failed — show minimal retry UI
  if (isTelegramContext) {
    return (
      <div style={{ flex: 1, minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>🧠</div>
        <p style={{ color: 'var(--text-sub)', marginBottom: 24, textAlign: 'center' }}>
          {telegramLoading ? 'Загрузка...' : 'Не удалось войти автоматически'}
        </p>
        {error && <p style={{ color: 'var(--accent-red)', fontSize: 13, marginBottom: 16, textAlign: 'center', maxWidth: 320 }}>{error}</p>}
        <button className="btn-outline" onClick={retryTelegramAuth} disabled={telegramLoading}>
          Попробовать снова
        </button>
      </div>
    );
  }

  return (
    <div style={{
      flex: 1,
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Ambient blobs */}
      <div style={{
        position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0,
      }}>
        <div style={{
          position: 'absolute', width: 600, height: 600,
          borderRadius: '50%', background: 'var(--blob-1)',
          filter: 'blur(80px)', top: '-10%', left: '-15%',
        }} />
        <div style={{
          position: 'absolute', width: 500, height: 500,
          borderRadius: '50%', background: 'var(--blob-2)',
          filter: 'blur(80px)', bottom: '-5%', right: '-10%',
        }} />
      </div>

      <div style={{
        width: '100%',
        maxWidth: 400,
        position: 'relative',
        zIndex: 1,
        animation: 'fade-in 0.4s ease both',
      }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div style={{
            width: 72, height: 72,
            background: 'linear-gradient(135deg, var(--accent-indigo), var(--accent))',
            borderRadius: 20,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 16px',
            fontSize: 36,
            boxShadow: '0 8px 32px rgba(124, 114, 248, 0.35)',
          }}>
            🧠
          </div>
          <h1 style={{ fontSize: 26, fontWeight: 700, marginBottom: 8 }}>СхемаЛаб</h1>
          <p style={{ color: 'var(--text-sub)', fontSize: 15, lineHeight: 1.5, maxWidth: 320, margin: '0 auto' }}>
            Инструмент схема-терапии для работы с мыслями, эмоциями и паттернами
          </p>
        </div>

        {/* Auth card */}
        <div className="card-elevated" style={{ padding: '28px 24px' }}>
          <p style={{ color: 'var(--text-sub)', fontSize: 13, marginBottom: 20, textAlign: 'center' }}>
            Войди, чтобы продолжить
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
          <div style={{
            display: 'flex', alignItems: 'center', gap: 12, margin: '16px 0',
          }}>
            <div style={{ flex: 1, height: 1, background: 'var(--line)' }} />
            <span style={{ color: 'var(--text-faint)', fontSize: 12 }}>или</span>
            <div style={{ flex: 1, height: 1, background: 'var(--line)' }} />
          </div>

          {/* Telegram widget */}
          <div style={{
            display: 'flex', justifyContent: 'center',
            opacity: telegramLoading ? 0.5 : 1,
            transition: 'opacity 0.2s',
            minHeight: 56,
          }}>
            <div ref={telegramRef} />
          </div>

          {/* Switch Telegram account */}
          <div style={{ textAlign: 'center', marginTop: 8 }}>
            <a
              href="https://oauth.telegram.org/logout"
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setTimeout(() => window.location.reload(), 800)}
              style={{ fontSize: 12, color: 'var(--text-faint)', textDecoration: 'none' }}
            >
              Не ты? Войти с другого аккаунта →
            </a>
          </div>

          {error && (
            <p style={{ color: 'var(--accent-red)', fontSize: 13, marginTop: 12, textAlign: 'center' }}>
              {error}
            </p>
          )}
        </div>

        {/* Privacy note */}
        <p style={{ color: 'var(--text-faint)', fontSize: 12, textAlign: 'center', marginTop: 20, lineHeight: 1.6 }}>
          Твои данные зашифрованы и никогда не передаются третьим лицам
        </p>
      </div>

      <style>{`@keyframes fade-in { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: none; } }`}</style>
    </div>
  );
}
