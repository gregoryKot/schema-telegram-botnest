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
  provider: 'google' | 'telegram' | 'vk';
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
    window.location.href = `${API_BASE}/api/auth/google?link_token=${encodeURIComponent(accessToken ?? '')}`;
  };
  const linkVk = () => {
    window.location.href = `${API_BASE}/api/auth/vk?link_token=${encodeURIComponent(accessToken ?? '')}`;
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

  const hasGoogle = providers.some(p => p.provider === 'google');
  const hasTelegram = providers.some(p => p.provider === 'telegram');
  const hasVk = providers.some(p => p.provider === 'vk');

  return (
    <div style={{ flex: 1, padding: 24, maxWidth: 480, margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
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

          {/* VK */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 0', borderTop: '1px solid rgba(var(--fg-rgb),0.07)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: '#0077FF', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 14, fontWeight: 800 }}>
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
              <button disabled={busy} onClick={linkVk} style={{ background: 'var(--accent)', border: 'none', color: 'white', borderRadius: 8, padding: '7px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                Привязать
              </button>
            )}
          </div>
        </div>
      )}

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
      <div style={{ fontSize: 13, color: 'var(--text-sub)', marginBottom: 8, fontWeight: 600, letterSpacing: 0.5 }}>РОЛЬ ПСИХОЛОГА</div>
      {req?.status === 'pending' ? (
        <div className="card" style={{ padding: 16, fontSize: 13, color: 'var(--text-sub)', lineHeight: 1.5 }}>
          ⏳ Твоя заявка на рассмотрении. Когда админ её обработает — придёт уведомление в Telegram.
        </div>
      ) : req?.status === 'approved' ? (
        <div className="card" style={{ padding: 16, fontSize: 13, color: 'var(--accent-green)' }}>
          ✅ Заявка одобрена. Перезайди в приложение.
        </div>
      ) : !open ? (
        <button onClick={() => setOpen(true)} style={{ width: '100%', padding: '14px 0', borderRadius: 12, border: '1px solid color-mix(in srgb, var(--accent) 30%, transparent)', background: 'color-mix(in srgb, var(--accent) 8%, transparent)', color: 'var(--accent)', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
          👨‍⚕️ Я психолог — подать заявку
        </button>
      ) : (
        <div className="card" style={{ padding: 16 }}>
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
            <button disabled={busy} onClick={submit} style={{ flex: 2, padding: '12px 0', borderRadius: 10, border: 'none', background: 'var(--accent)', color: 'white', fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: busy ? 0.6 : 1 }}>{busy ? 'Отправляю…' : 'Отправить заявку'}</button>
          </div>
          {err && <div style={{ fontSize: 12, color: 'var(--accent-red)', marginTop: 8 }}>{err}</div>}
        </div>
      )}
    </div>
  );
}
