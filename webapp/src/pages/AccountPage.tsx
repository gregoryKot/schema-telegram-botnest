import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../auth/authContext';

import { API_BASE } from '../utils/apiBase';
import { useTr } from '../utils/addressForm';
import { TherapistRequestSection } from './account/TherapistRequestSection';
import { TwoFactorSection } from './account/TwoFactorSection';
import { EmailIcon, GoogleIcon, MaxIcon, ProviderRow, TelegramIcon, VkIcon, type AccountProvider } from './account/ProviderRows';

type Provider = AccountProvider;

export function AccountPage() {
  const { accessToken, logout } = useAuth();
  const tr = useTr();
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

  const unlink = async (provider: Provider['provider']) => {
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
  const hasMax = providers.some(p => p.provider === 'max');

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
        {tr('Привязывай несколько способов входа – заходи откуда удобно', 'Привязывайте несколько способов входа – заходите откуда удобно')}
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
          <ProviderRow icon={<GoogleIcon />} title="Google" divider linked={hasGoogle} busy={busy}
            subtitle={providers.find(p => p.provider === 'google')?.email}
            onLink={linkGoogle} onUnlink={() => unlink('google')} />

          <ProviderRow icon={<TelegramIcon />} title="Telegram" linked={hasTelegram} busy={busy}
            subtitle={providers.find(p => p.provider === 'telegram')?.displayName ?? 'привязан'}
            onLink={linkTelegram} onUnlink={() => unlink('telegram')} />

          <ProviderRow icon={<VkIcon />} title="ВКонтакте" divider linked={hasVk} busy={busy}
            subtitle={providers.find(p => p.provider === 'vk')?.displayName ?? providers.find(p => p.provider === 'vk')?.email ?? 'привязан'}
            onLink={linkVk} onUnlink={() => unlink('vk')} />

          {/* MAX: своего входа для сайтов у площадки нет — привязка начинается
              в самом приложении, поэтому кнопки «Привязать» здесь быть не может. */}
          {hasMax && (
            <ProviderRow icon={<MaxIcon />} title="MAX" divider linked busy={busy}
              subtitle={providers.find(p => p.provider === 'max')?.displayName ?? 'привязан'}
              onUnlink={() => unlink('max')} />
          )}

          {/* Email */}
          <div style={{ padding: '14px 0' }}>
            <ProviderRow icon={<EmailIcon />} title="Email" linked={hasEmail} busy={busy} emptySubtitle="не привязан"
              subtitle={providers.find(p => p.provider === 'email')?.email ?? 'привязан'}
              onUnlink={() => unlink('email')}
              onLink={() => { setShowEmailLink(true); setEmailLinkSent(false); setEmailInput(''); }} />
            {showEmailLink && !hasEmail && (
              emailLinkSent ? (
                <div style={{ marginTop: 12, padding: '12px 14px', background: 'rgba(var(--fg-rgb),0.04)', borderRadius: 10, fontSize: 13, color: 'var(--text-sub)', lineHeight: 1.5 }}>
                  Письмо отправлено на <b>{emailInput}</b>. {tr('Перейди по ссылке в письме — она привяжет email к аккаунту.', 'Перейдите по ссылке в письме — она привяжет email к аккаунту.')}
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
