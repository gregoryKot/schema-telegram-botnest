import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? '';
const BOT_USERNAME = (import.meta.env.VITE_BOT_USERNAME as string | undefined) ?? 'SchemaLabBot';

declare global {
  interface Window {
    onTelegramLink?: (user: Record<string, string>) => void;
  }
}

interface Provider {
  provider: 'google' | 'telegram';
  email: string | null;
  displayName: string | null;
}

export function AccountPage() {
  const { accessToken, logout } = useAuth();
  const navigate = useNavigate();
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const tgRef = useRef<HTMLDivElement>(null);

  const refresh = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/auth/me`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) throw new Error('Failed to load account');
      const data = await res.json() as { providers: Provider[] };
      setProviders(data.providers);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { refresh(); }, [accessToken]);

  // Inject Telegram Login Widget when user wants to link
  const [showTgWidget, setShowTgWidget] = useState(false);
  useEffect(() => {
    if (!showTgWidget || !tgRef.current) return;
    window.onTelegramLink = async (userData) => {
      setBusy(true);
      setError(null);
      try {
        const res = await fetch(`${API_BASE}/api/auth/link/telegram`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
          body: JSON.stringify(userData),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({ message: 'Link failed' }));
          throw new Error(body.message ?? 'Link failed');
        }
        const data = await res.json() as { ok?: true } | { merge: true; mergeToken: string; summary: Record<string, number> };
        if ('merge' in data) {
          // Conflict — go to merge confirmation
          const params = new URLSearchParams({
            token: data.mergeToken,
            summary: JSON.stringify(data.summary),
            provider: 'telegram',
            name: userData.first_name ?? '',
          });
          navigate(`/account/merge?${params.toString()}`);
          return;
        }
        await refresh();
        setShowTgWidget(false);
      } catch (e) {
        setError(String(e));
      } finally {
        setBusy(false);
      }
    };
    const script = document.createElement('script');
    script.src = 'https://telegram.org/js/telegram-widget.js?22';
    script.async = true;
    script.setAttribute('data-telegram-login', BOT_USERNAME);
    script.setAttribute('data-size', 'large');
    script.setAttribute('data-onauth', 'onTelegramLink(user)');
    script.setAttribute('data-request-access', 'write');
    tgRef.current.appendChild(script);
    return () => { delete window.onTelegramLink; };
  }, [showTgWidget, accessToken]);

  const linkGoogle = () => {
    // Top-level navigation — pass access token via query so backend knows to link
    window.location.href = `${API_BASE}/api/auth/google?link_token=${encodeURIComponent(accessToken ?? '')}`;
  };

  const unlink = async (provider: 'google' | 'telegram') => {
    if (!confirm(`Отвязать ${provider === 'google' ? 'Google' : 'Telegram'}?`)) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/auth/unlink/${provider}`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'x-requested-with': 'webapp', Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({ message: 'Unlink failed' }));
        throw new Error(body.message ?? 'Unlink failed');
      }
      await refresh();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  };

  const hasGoogle = providers.some(p => p.provider === 'google');
  const hasTelegram = providers.some(p => p.provider === 'telegram');

  return (
    <div style={{ padding: 24, maxWidth: 480, margin: '0 auto' }}>
      <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', color: 'var(--accent)', fontSize: 15, marginBottom: 16, cursor: 'pointer', padding: 0 }}>
        ← Назад
      </button>

      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>Аккаунт</h1>
      <p style={{ color: 'var(--text-sub)', fontSize: 14, marginBottom: 24 }}>
        Привязывай несколько способов входа — заходи откуда удобно
      </p>

      {error && (
        <div style={{ background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)', borderRadius: 12, padding: 12, marginBottom: 16, color: 'var(--accent-red)', fontSize: 13 }}>
          {error}
        </div>
      )}

      {loading ? (
        <div className="loader-center" style={{ minHeight: 200 }}><div className="spinner" /></div>
      ) : (
        <div className="card" style={{ padding: '20px' }}>
          {/* Google */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 0', borderBottom: '1px solid rgba(var(--fg-rgb),0.07)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(var(--fg-rgb),0.04)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                  <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
                  <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.859-3.048.859-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z" fill="#34A853"/>
                  <path d="M3.964 10.71c-.18-.54-.282-1.117-.282-1.71s.102-1.17.282-1.71V4.958H.957C.347 6.173 0 7.548 0 9s.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
                  <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.958L3.964 6.29C4.672 4.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
                </svg>
              </div>
              <div>
                <div style={{ fontWeight: 600, fontSize: 14 }}>Google</div>
                {hasGoogle && <div style={{ color: 'var(--text-sub)', fontSize: 12 }}>{providers.find(p => p.provider === 'google')?.email}</div>}
              </div>
            </div>
            {hasGoogle ? (
              <button disabled={busy} onClick={() => unlink('google')} style={{ background: 'transparent', border: '1px solid rgba(var(--fg-rgb),0.15)', color: 'var(--text-sub)', borderRadius: 8, padding: '6px 12px', fontSize: 12, cursor: 'pointer' }}>
                Отвязать
              </button>
            ) : (
              <button disabled={busy} onClick={linkGoogle} style={{ background: 'var(--accent)', border: 'none', color: 'white', borderRadius: 8, padding: '7px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                Привязать
              </button>
            )}
          </div>

          {/* Telegram */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(34,158,217,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>
                ✈️
              </div>
              <div>
                <div style={{ fontWeight: 600, fontSize: 14 }}>Telegram</div>
                {hasTelegram && <div style={{ color: 'var(--text-sub)', fontSize: 12 }}>{providers.find(p => p.provider === 'telegram')?.displayName ?? 'привязан'}</div>}
              </div>
            </div>
            {hasTelegram ? (
              <button disabled={busy} onClick={() => unlink('telegram')} style={{ background: 'transparent', border: '1px solid rgba(var(--fg-rgb),0.15)', color: 'var(--text-sub)', borderRadius: 8, padding: '6px 12px', fontSize: 12, cursor: 'pointer' }}>
                Отвязать
              </button>
            ) : (
              <button disabled={busy} onClick={() => setShowTgWidget(true)} style={{ background: 'var(--accent)', border: 'none', color: 'white', borderRadius: 8, padding: '7px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                Привязать
              </button>
            )}
          </div>

          {showTgWidget && !hasTelegram && (
            <div style={{ paddingTop: 12, display: 'flex', justifyContent: 'center', minHeight: 56 }}>
              <div ref={tgRef} />
            </div>
          )}
        </div>
      )}

      <button onClick={() => logout()} style={{ marginTop: 24, width: '100%', background: 'transparent', border: '1px solid rgba(var(--fg-rgb),0.15)', color: 'var(--text-sub)', borderRadius: 12, padding: '14px 0', fontSize: 14, cursor: 'pointer' }}>
        Выйти
      </button>
    </div>
  );
}
