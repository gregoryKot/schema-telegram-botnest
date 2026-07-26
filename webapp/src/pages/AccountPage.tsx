import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../auth/authContext';

import { API_BASE } from '../utils/apiBase';
import { TherapistRequestSection } from './account/TherapistRequestSection';
import { TwoFactorSection } from './account/TwoFactorSection';

interface Provider {
  provider: 'google' | 'telegram' | 'vk' | 'email';
  email: string | null;
  displayName: string | null;
}

export function AccountPage() {
  const { accessToken, logout } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [providers, setProviders] = useState<Provider[]>([]);
  const [totp, setTotp] = useState<{ enabled: boolean; recoveryCodesLeft: number }>({ enabled: false, recoveryCodesLeft: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const success = searchParams.get('linked') === 'email' ? '✓ Email успешно привязан' : null;
  const [busy, setBusy] = useState(false);

  // Pure fetch (no setState), so it can be shared by the mount effect and the
  // manual refresh without either duplicating the request.
  const loadAccount = useCallback(async () => {
    const res = await fetch(`${API_BASE}/api/auth/me`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) throw new Error('Failed to load account');
    return await res.json() as { providers: Provider[]; totp?: { enabled: boolean; recoveryCodesLeft: number } };
  }, [accessToken]);

  const refresh = async () => {
    setLoading(true);
    try {
      const data = await loadAccount();
      setProviders(data.providers);
      if (data.totp) setTotp(data.totp);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  // Re-show loading when the token changes (adjust during render, not in an
  // effect); on mount `loading` already starts true.
  const [seenToken, setSeenToken] = useState(accessToken);
  if (accessToken !== seenToken) { setSeenToken(accessToken); setLoading(true); }

  // Load account on mount / token change. Fetch lives inside the effect, guarded
  // by `alive`, so nothing sets state synchronously and deps are complete.
  useEffect(() => {
    let alive = true;
    loadAccount()
      .then((data) => { if (alive) { setProviders(data.providers); if (data.totp) setTotp(data.totp); } })
      .catch((e) => { if (alive) setError(String(e)); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [loadAccount]);

  // Email link state
  const [showEmailLink, setShowEmailLink] = useState(false);
  const [emailInput, setEmailInput] = useState('');
  const [emailLinkSent, setEmailLinkSent] = useState(false);
  const [emailLinkBusy, setEmailLinkBusy] = useState(false);
  const emailInputRef = useRef<HTMLInputElement>(null);

  // Запрос ставит httpOnly-cookie `link_token` (60 c) — токен больше не
  // передаётся в URL (не попадает в логи/историю браузера).
  const fetchLinkToken = async (): Promise<void> => {
    await fetch(`${API_BASE}/api/auth/link-token`, {
      credentials: 'include',
      headers: { Authorization: `Bearer ${accessToken ?? ''}` },
    });
  };
  const linkGoogle = async () => {
    sessionStorage.setItem('auth_return_to', '/account');
    await fetchLinkToken();
    window.location.href = `${API_BASE}/api/auth/google`;
  };
  const linkVk = async () => {
    sessionStorage.setItem('auth_return_to', '/account');
    await fetchLinkToken();
    window.location.href = `${API_BASE}/api/auth/vk`;
  };
  const linkTelegram = () => {
    sessionStorage.setItem('auth_return_to', '/account');
    window.location.href = `${API_BASE}/api/auth/telegram/redirect`;
  };

  const unlink = async (provider: 'google' | 'telegram' | 'vk' | 'email') => {
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

  const sendEmailLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmailLinkBusy(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/auth/email/link-to-account`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', 'x-requested-with': 'webapp', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ email: emailInput }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({ message: 'Ошибка' }));
        throw new Error(body.message ?? `Ошибка ${res.status}`);
      }
      setEmailLinkSent(true);
    } catch (e) {
      setError(String(e).replace('Error: ', ''));
    } finally {
      setEmailLinkBusy(false);
    }
  };

  const hasGoogle = providers.some(p => p.provider === 'google');
  const hasTelegram = providers.some(p => p.provider === 'telegram');
  const hasVk = providers.some(p => p.provider === 'vk');
  const hasEmail = providers.some(p => p.provider === 'email');

  useEffect(() => {
    if (showEmailLink && !hasEmail && !emailLinkSent) emailInputRef.current?.focus();
  }, [showEmailLink, hasEmail, emailLinkSent]);

  return (
    <div style={{ flex: 1, padding: 24, maxWidth: 480, margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
      <button onClick={() => navigate('/today')} style={{ background: 'none', border: 'none', color: 'var(--accent)', fontSize: 15, marginBottom: 16, cursor: 'pointer', padding: 0 }}>
        ← Назад
      </button>

      <h1 style={{ fontSize: 32, fontWeight: 600, letterSpacing: '-0.03em', lineHeight: 1.1, marginBottom: 8 }}>Аккаунт</h1>
      <p style={{ color: 'var(--text-sub)', fontSize: 14, marginBottom: 24 }}>
        Привязывай несколько способов входа – заходи откуда удобно
      </p>

      {success && (
        <div style={{ background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.3)', borderRadius: 12, padding: 12, marginBottom: 16, color: 'var(--accent-green)', fontSize: 13 }}>
          {success}
        </div>
      )}

      {error && (
        <div style={{ background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)', borderRadius: 12, padding: 12, marginBottom: 16, color: 'var(--accent-red)', fontSize: 13 }}>
          {error}
        </div>
      )}

      {loading ? (
        <div className="loader-center" style={{ minHeight: 200 }}><div className="spinner" /></div>
      ) : (
        <div className="card-elevated" style={{ padding: '20px' }}>
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
              <button disabled={busy} onClick={linkGoogle} style={{ background: 'var(--text)', border: 'none', color: 'var(--bg)', borderRadius: 6, padding: '7px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                Привязать
              </button>
            )}
          </div>

          {/* Telegram */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(34,158,217,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm4.93 6.89l-1.68 7.92c-.12.56-.45.7-.9.43l-2.5-1.84-1.2 1.16c-.13.13-.25.25-.5.25l.18-2.55 4.63-4.18c.2-.18-.04-.27-.31-.1l-5.72 3.6-2.46-.77c-.54-.17-.55-.54.11-.8l9.58-3.69c.45-.16.85.11.69.77z" fill="#2AABEE"/>
                </svg>
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
              <button disabled={busy} onClick={linkTelegram} style={{ background: 'var(--text)', border: 'none', color: 'var(--bg)', borderRadius: 6, padding: '7px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                Привязать
              </button>
            )}
          </div>

          {/* VK */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 0', borderTop: '1px solid rgba(var(--fg-rgb),0.07)', borderBottom: '1px solid rgba(var(--fg-rgb),0.07)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: '#0077FF', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 14, fontWeight: 600 }}>
                VK
              </div>
              <div>
                <div style={{ fontWeight: 600, fontSize: 14 }}>ВКонтакте</div>
                {hasVk && <div style={{ color: 'var(--text-sub)', fontSize: 12 }}>{providers.find(p => p.provider === 'vk')?.displayName ?? providers.find(p => p.provider === 'vk')?.email ?? 'привязан'}</div>}
              </div>
            </div>
            {hasVk ? (
              <button disabled={busy} onClick={() => unlink('vk')} style={{ background: 'transparent', border: '1px solid rgba(var(--fg-rgb),0.15)', color: 'var(--text-sub)', borderRadius: 8, padding: '6px 12px', fontSize: 12, cursor: 'pointer' }}>
                Отвязать
              </button>
            ) : (
              <button disabled={busy} onClick={linkVk} style={{ background: 'var(--text)', border: 'none', color: 'var(--bg)', borderRadius: 6, padding: '7px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                Привязать
              </button>
            )}
          </div>

          {/* Email */}
          <div style={{ padding: '14px 0' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(var(--fg-rgb),0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>
                  ✉️
                </div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>Email</div>
                  {hasEmail && <div style={{ color: 'var(--text-sub)', fontSize: 12 }}>{providers.find(p => p.provider === 'email')?.email ?? 'привязан'}</div>}
                  {!hasEmail && <div style={{ color: 'var(--text-faint)', fontSize: 12 }}>не привязан</div>}
                </div>
              </div>
              {hasEmail ? (
                <button disabled={busy} onClick={() => unlink('email')} style={{ background: 'transparent', border: '1px solid rgba(var(--fg-rgb),0.15)', color: 'var(--text-sub)', borderRadius: 8, padding: '6px 12px', fontSize: 12, cursor: 'pointer' }}>
                  Отвязать
                </button>
              ) : (
                <button disabled={busy} onClick={() => { setShowEmailLink(true); setEmailLinkSent(false); setEmailInput(''); }} style={{ background: 'var(--text)', border: 'none', color: 'var(--bg)', borderRadius: 6, padding: '7px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                  Привязать
                </button>
              )}
            </div>
            {showEmailLink && !hasEmail && (
              emailLinkSent ? (
                <div style={{ marginTop: 12, padding: '12px 14px', background: 'rgba(var(--fg-rgb),0.04)', borderRadius: 10, fontSize: 13, color: 'var(--text-sub)', lineHeight: 1.5 }}>
                  ✉️ Письмо отправлено на <b>{emailInput}</b>. Перейди по ссылке в письме — она привяжет email к аккаунту.
                  <button onClick={() => { setEmailLinkSent(false); setEmailInput(''); }} style={{ display: 'block', marginTop: 8, background: 'none', border: 'none', color: 'var(--text-faint)', fontSize: 12, cursor: 'pointer', textDecoration: 'underline', padding: 0 }}>
                    Ввести другой email
                  </button>
                </div>
              ) : (
                <form onSubmit={sendEmailLink} style={{ marginTop: 12, display: 'flex', gap: 8 }}>
                  <input
                    type="email" required ref={emailInputRef}
                    placeholder="your@email.com"
                    value={emailInput}
                    onChange={e => setEmailInput(e.target.value)}
                    style={{ flex: 1, padding: '9px 12px', fontSize: 13, border: '1.5px solid var(--line)', borderRadius: 8, background: 'rgba(var(--fg-rgb),0.04)', color: 'var(--text)', fontFamily: 'inherit', outline: 'none' }}
                  />
                  <button type="submit" disabled={emailLinkBusy} style={{ padding: '9px 14px', fontSize: 12, fontWeight: 600, background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 8, cursor: emailLinkBusy ? 'default' : 'pointer', opacity: emailLinkBusy ? 0.7 : 1, whiteSpace: 'nowrap' }}>
                    {emailLinkBusy ? '…' : 'Отправить'}
                  </button>
                </form>
              )
            )}
          </div>
        </div>
      )}

      <TwoFactorSection accessToken={accessToken} totp={totp} onChanged={refresh} />

      <TherapistRequestSection accessToken={accessToken} />

      <button onClick={() => logout()} style={{ marginTop: 24, width: '100%', background: 'transparent', border: '1px solid rgba(var(--fg-rgb),0.15)', color: 'var(--text-sub)', borderRadius: 12, padding: '14px 0', fontSize: 14, cursor: 'pointer' }}>
        Выйти
      </button>
    </div>
  );
}
