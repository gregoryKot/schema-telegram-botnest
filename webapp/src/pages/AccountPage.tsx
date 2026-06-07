import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? '';

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
  const [success, setSuccess] = useState<string | null>(
    searchParams.get('linked') === 'email' ? '✓ Email успешно привязан' : null,
  );
  const [busy, setBusy] = useState(false);

  const refresh = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/auth/me`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) throw new Error('Failed to load account');
      const data = await res.json() as { providers: Provider[]; totp?: { enabled: boolean; recoveryCodesLeft: number } };
      setProviders(data.providers);
      if (data.totp) setTotp(data.totp);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { refresh(); }, [accessToken]);

  // Email link state
  const [showEmailLink, setShowEmailLink] = useState(false);
  const [emailInput, setEmailInput] = useState('');
  const [emailLinkSent, setEmailLinkSent] = useState(false);
  const [emailLinkBusy, setEmailLinkBusy] = useState(false);

  const fetchLinkToken = async (): Promise<string> => {
    const res = await fetch(`${API_BASE}/api/auth/link-token`, {
      credentials: 'include',
      headers: { Authorization: `Bearer ${accessToken ?? ''}` },
    });
    const { linkToken } = await res.json() as { linkToken: string };
    return linkToken;
  };
  const linkGoogle = async () => {
    sessionStorage.setItem('auth_return_to', '/account');
    const token = await fetchLinkToken();
    window.location.href = `${API_BASE}/api/auth/google?link_token=${encodeURIComponent(token)}`;
  };
  const linkVk = async () => {
    sessionStorage.setItem('auth_return_to', '/account');
    const token = await fetchLinkToken();
    window.location.href = `${API_BASE}/api/auth/vk?link_token=${encodeURIComponent(token)}`;
  };
  const linkTelegram = () => {
    sessionStorage.setItem('auth_return_to', '/account');
    window.location.href = `${API_BASE}/api/auth/telegram/redirect`;
  };

  const unlink = async (provider: 'google' | 'telegram' | 'vk') => {
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
                <button disabled={busy} onClick={() => unlink('email' as any)} style={{ background: 'transparent', border: '1px solid rgba(var(--fg-rgb),0.15)', color: 'var(--text-sub)', borderRadius: 8, padding: '6px 12px', fontSize: 12, cursor: 'pointer' }}>
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
                    type="email" required autoFocus
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

interface TherapistRequest {
  id: number;
  status: 'pending' | 'approved' | 'rejected';
  rejectReason: string | null;
  createdAt: string;
  reviewedAt: string | null;
}

function TherapistRequestSection({ accessToken }: { accessToken: string | null }) {
  const [req, setReq] = useState<TherapistRequest | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [open, setOpen] = useState(false);
  const [fullName, setFullName] = useState('');
  const [qualification, setQualification] = useState('');
  const [contacts, setContacts] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${API_BASE}/api/therapy/request`, { headers: { Authorization: `Bearer ${accessToken}` } })
      .then(r => r.json()).then(setReq).catch(() => {})
      .finally(() => setLoaded(true));
  }, [accessToken]);

  if (!loaded) return null;

  const submit = async () => {
    setErr(null);
    if (!fullName.trim() || !qualification.trim() || !contacts.trim()) {
      setErr('Заполни ФИО, квалификацию и контакты');
      return;
    }
    setBusy(true);
    try {
      const r = await fetch(`${API_BASE}/api/therapy/request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({
          fullName: fullName.trim(),
          qualification: qualification.trim(),
          contacts: contacts.trim(),
          message: message.trim() || undefined,
        }),
      });
      if (!r.ok) {
        const body = await r.json().catch(() => ({ message: 'Ошибка' }));
        throw new Error(body.message ?? 'Ошибка');
      }
      setReq({ id: 0, status: 'pending', rejectReason: null, createdAt: new Date().toISOString(), reviewedAt: null });
      setOpen(false);
    } catch (e) {
      setErr(String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ marginTop: 24 }}>
      <div className="eyebrow" style={{ marginBottom: 8 }}>Роль психолога</div>
      {req?.status === 'pending' ? (
        <div className="card-elevated" style={{ padding: 16, fontSize: 13, color: 'var(--text-sub)', lineHeight: 1.5 }}>
          ⏳ Твоя заявка на рассмотрении. Когда админ её обработает – придёт уведомление в Telegram.
        </div>
      ) : req?.status === 'approved' ? (
        <div className="card-elevated" style={{ padding: 16, fontSize: 13, color: 'var(--accent-green)' }}>
          ✅ Заявка одобрена. Перезайди в приложение.
        </div>
      ) : !open ? (
        <button onClick={() => setOpen(true)} style={{ padding: '9px 20px', borderRadius: 6, border: '1px solid rgba(var(--fg-rgb),0.15)', background: 'transparent', color: 'var(--text-sub)', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>
          👨‍⚕️ Я психолог – подать заявку
        </button>
      ) : (
        <div className="card-elevated" style={{ padding: 16 }}>
          {req?.status === 'rejected' && (
            <div style={{ fontSize: 12, color: 'var(--accent-red)', marginBottom: 10, padding: 8, background: 'rgba(248,113,113,0.08)', borderRadius: 8 }}>
              Прошлая заявка отклонена{req.rejectReason ? `: ${req.rejectReason}` : ''}. Можешь подать новую.
            </div>
          )}
          <input value={fullName} onChange={e => setFullName(e.target.value)} placeholder="ФИО"
            style={{ width: '100%', boxSizing: 'border-box', marginBottom: 8, background: 'rgba(var(--fg-rgb),0.06)', border: '1px solid rgba(var(--fg-rgb),0.12)', borderRadius: 10, padding: '10px 12px', color: 'var(--text)', fontSize: 14 }} />
          <textarea value={qualification} onChange={e => setQualification(e.target.value)} rows={3}
            placeholder="Квалификация: образование, направление, опыт, сертификаты"
            style={{ width: '100%', boxSizing: 'border-box', marginBottom: 8, background: 'rgba(var(--fg-rgb),0.06)', border: '1px solid rgba(var(--fg-rgb),0.12)', borderRadius: 10, padding: '10px 12px', color: 'var(--text)', fontSize: 14, fontFamily: 'inherit', resize: 'vertical' }} />
          <input value={contacts} onChange={e => setContacts(e.target.value)} placeholder="Контакты: сайт, @telegram, b17 и т.д."
            style={{ width: '100%', boxSizing: 'border-box', marginBottom: 8, background: 'rgba(var(--fg-rgb),0.06)', border: '1px solid rgba(var(--fg-rgb),0.12)', borderRadius: 10, padding: '10px 12px', color: 'var(--text)', fontSize: 14 }} />
          <textarea value={message} onChange={e => setMessage(e.target.value)} rows={2}
            placeholder="Сообщение админу (необязательно)"
            style={{ width: '100%', boxSizing: 'border-box', marginBottom: 8, background: 'rgba(var(--fg-rgb),0.06)', border: '1px solid rgba(var(--fg-rgb),0.12)', borderRadius: 10, padding: '10px 12px', color: 'var(--text)', fontSize: 14, fontFamily: 'inherit', resize: 'vertical' }} />
          <div style={{ display: 'flex', gap: 8 }}>
            <button disabled={busy} onClick={() => setOpen(false)} style={{ flex: 1, padding: '12px 0', borderRadius: 10, border: '1px solid rgba(var(--fg-rgb),0.15)', background: 'transparent', color: 'var(--text-sub)', fontSize: 13, cursor: 'pointer' }}>Отмена</button>
            <button disabled={busy} onClick={submit} style={{ flex: 2, padding: '10px 0', borderRadius: 6, border: 'none', background: 'var(--text)', color: 'var(--bg)', fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: busy ? 0.6 : 1 }}>{busy ? 'Отправляю…' : 'Отправить заявку'}</button>
          </div>
          {err && <div style={{ fontSize: 12, color: 'var(--accent-red)', marginTop: 8 }}>{err}</div>}
        </div>
      )}
    </div>
  );
}

// ─── 2FA section ─────────────────────────────────────────────────────────────

function TwoFactorSection({
  accessToken, totp, onChanged,
}: {
  accessToken: string | null;
  totp: { enabled: boolean; recoveryCodesLeft: number };
  onChanged: () => void;
}) {
  const [setupOpen, setSetupOpen] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [otpauthUrl, setOtpauthUrl] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);
  const [disableMode, setDisableMode] = useState(false);

  const csrfHeaders = (): Record<string, string> => ({
    'Content-Type': 'application/json',
    'x-requested-with': 'webapp',
    Authorization: `Bearer ${accessToken}`,
  });

  const startSetup = async () => {
    setBusy(true); setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/auth/2fa/setup`, { method: 'POST', credentials: 'include', headers: csrfHeaders() });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message ?? 'Не удалось начать настройку');
      const data = await res.json() as { qrDataUrl: string; otpauthUrl: string };
      setQrDataUrl(data.qrDataUrl);
      setOtpauthUrl(data.otpauthUrl);
      setSetupOpen(true);
    } catch (e) { setError(String(e).replace('Error: ', '')); }
    finally { setBusy(false); }
  };

  const confirm = async () => {
    setBusy(true); setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/auth/2fa/enable`, {
        method: 'POST', credentials: 'include', headers: csrfHeaders(),
        body: JSON.stringify({ code: code.trim() }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message ?? 'Неверный код');
      const data = await res.json() as { recoveryCodes: string[] };
      setRecoveryCodes(data.recoveryCodes);
      setCode('');
      setQrDataUrl(null);
      onChanged();
    } catch (e) { setError(String(e).replace('Error: ', '')); }
    finally { setBusy(false); }
  };

  const disable = async () => {
    setBusy(true); setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/auth/2fa/disable`, {
        method: 'POST', credentials: 'include', headers: csrfHeaders(),
        body: JSON.stringify({ code: code.trim() }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message ?? 'Неверный код');
      setCode('');
      setDisableMode(false);
      onChanged();
    } catch (e) { setError(String(e).replace('Error: ', '')); }
    finally { setBusy(false); }
  };

  if (recoveryCodes) {
    return (
      <div style={{ marginTop: 32 }}>
        <div className="eyebrow" style={{ marginBottom: 12 }}>Recovery-коды</div>
        <div className="text-sm muted" style={{ marginBottom: 12, lineHeight: 1.5 }}>
          Сохрани эти коды в надёжном месте (пароль-менеджер). Каждый можно использовать
          один раз вместо TOTP-кода если потеряешь телефон.
        </div>
        <div style={{
          fontFamily: 'monospace', fontSize: 14, lineHeight: 2,
          padding: '14px 18px', background: 'var(--surface-2)', borderRadius: 10,
          letterSpacing: '0.05em', columnCount: 2, columnGap: 24,
        }}>
          {recoveryCodes.map(c => <div key={c}>{c}</div>)}
        </div>
        <button onClick={() => setRecoveryCodes(null)} className="btn btn-secondary" style={{ marginTop: 14 }}>
          Готово, я сохранил
        </button>
      </div>
    );
  }

  return (
    <div style={{ marginTop: 32 }}>
      <div className="eyebrow" style={{ marginBottom: 12 }}>Двухфакторная аутентификация</div>

      {!totp.enabled && !setupOpen && (
        <div className="text-sm muted" style={{ lineHeight: 1.6, marginBottom: 14 }}>
          Дополнительный код из приложения (Google Authenticator, 1Password, …) при каждом входе.
          Защищает аккаунт даже если у тебя украдут Google/Telegram/VK.
        </div>
      )}

      {totp.enabled && !disableMode && (
        <>
          <div className="text-sm" style={{ marginBottom: 14 }}>
            <span style={{ color: 'var(--c-moss)' }}>✓ Включена.</span>{' '}
            <span className="muted">Recovery-кодов осталось: {totp.recoveryCodesLeft}</span>
          </div>
          <button onClick={() => setDisableMode(true)} className="btn btn-secondary" disabled={busy}>
            Отключить 2FA
          </button>
        </>
      )}

      {totp.enabled && disableMode && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div className="text-sm muted">Введи текущий код из приложения, чтобы отключить:</div>
          <input
            value={code} onChange={e => setCode(e.target.value)}
            placeholder="123456" inputMode="numeric" autoComplete="one-time-code"
            style={{ padding: '12px 14px', border: '1px solid var(--line)', borderRadius: 10, background: 'var(--surface)', color: 'var(--text)', fontSize: 18, letterSpacing: '0.2em', textAlign: 'center', fontFamily: 'monospace' }}
          />
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={disable} disabled={busy || !code.trim()} className="btn btn-primary">
              {busy ? 'Отключаю…' : 'Отключить'}
            </button>
            <button onClick={() => { setDisableMode(false); setCode(''); setError(null); }} disabled={busy} className="btn btn-secondary">
              Отмена
            </button>
          </div>
        </div>
      )}

      {!totp.enabled && !setupOpen && (
        <button onClick={startSetup} disabled={busy} className="btn btn-primary">
          {busy ? 'Подготавливаю…' : 'Включить 2FA'}
        </button>
      )}

      {!totp.enabled && setupOpen && qrDataUrl && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 8 }}>
          <div className="text-sm muted" style={{ lineHeight: 1.6 }}>
            1. Установи приложение-аутентификатор (Google Authenticator, 1Password, Bitwarden, Authy).<br/>
            2. Отсканируй QR. Или введи секрет вручную из ссылки ниже.<br/>
            3. Введи 6-значный код из приложения чтобы завершить.
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', padding: 12, background: 'white', borderRadius: 10, alignSelf: 'flex-start' }}>
            <img src={qrDataUrl} alt="TOTP QR" width={200} height={200} />
          </div>
          {otpauthUrl && (
            <details className="text-sm muted">
              <summary style={{ cursor: 'pointer' }}>Не сканируется QR? Ввести секрет вручную</summary>
              <div style={{ marginTop: 6, padding: 10, background: 'var(--surface-2)', borderRadius: 8, wordBreak: 'break-all', fontFamily: 'monospace', fontSize: 11 }}>
                {otpauthUrl}
              </div>
            </details>
          )}
          <input
            value={code} onChange={e => setCode(e.target.value)}
            placeholder="123456" inputMode="numeric" autoComplete="one-time-code"
            style={{ padding: '12px 14px', border: '1px solid var(--line)', borderRadius: 10, background: 'var(--surface)', color: 'var(--text)', fontSize: 18, letterSpacing: '0.2em', textAlign: 'center', fontFamily: 'monospace' }}
          />
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={confirm} disabled={busy || !code.trim()} className="btn btn-primary">
              {busy ? 'Проверяю…' : 'Подтвердить'}
            </button>
            <button onClick={() => { setSetupOpen(false); setQrDataUrl(null); setCode(''); setError(null); }} disabled={busy} className="btn btn-secondary">
              Отмена
            </button>
          </div>
        </div>
      )}

      {error && (
        <div className="text-sm" style={{ color: 'var(--c-rose)', marginTop: 10 }}>{error}</div>
      )}
    </div>
  );
}
