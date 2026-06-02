import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? '';

// Two modes:
//   /auth/recovery        — request form (anyone, no auth needed)
//   /auth/recovery/confirm?token=... — consume magic link, log user in
export function RecoveryPage() {
  const [params] = useSearchParams();
  const token = params.get('token');
  return token ? <RecoveryConfirm token={token} /> : <RecoveryRequest />;
}

function RecoveryRequest() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/auth/recovery/request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message ?? 'Не удалось отправить письмо');
      }
      setSent(true);
    } catch (e) { setError(String(e).replace('Error: ', '')); }
    finally { setBusy(false); }
  };

  if (sent) {
    return (
      <div className="page-inner-wide" style={{ paddingTop: 80, maxWidth: 480, margin: '0 auto' }}>
        <div className="eyebrow" style={{ marginBottom: 14 }}>Восстановление</div>
        <h1 style={{ fontSize: 28, fontWeight: 600, marginBottom: 14 }}>Проверь почту</h1>
        <div className="text-md muted" style={{ lineHeight: 1.6 }}>
          Если этот email привязан к аккаунту — на него отправлено письмо со ссылкой.
          Ссылка действует 30 минут. Не пришло? Проверь спам.
        </div>
        <button onClick={() => navigate('/login')} className="btn btn-secondary" style={{ marginTop: 24 }}>
          На страницу входа
        </button>
      </div>
    );
  }

  return (
    <div className="page-inner-wide" style={{ paddingTop: 80, maxWidth: 480, margin: '0 auto' }}>
      <div className="eyebrow" style={{ marginBottom: 14 }}>Восстановление доступа</div>
      <h1 style={{ fontSize: 28, fontWeight: 600, lineHeight: 1.1, marginBottom: 14 }}>Потерял доступ?</h1>
      <div className="text-md muted" style={{ lineHeight: 1.6, marginBottom: 24 }}>
        Если у тебя был привязан и подтверждён recovery-email — введи его, мы пришлём ссылку для входа.
        Иначе доступ к аккаунту восстановить нельзя.
      </div>
      <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <input
          type="email" required value={email} onChange={e => setEmail(e.target.value)}
          placeholder="you@example.com"
          style={{ padding: '13px 16px', border: '1px solid var(--line)', borderRadius: 12, background: 'var(--surface)', color: 'var(--text)', fontSize: 15 }}
        />
        {error && <div className="text-sm" style={{ color: 'var(--c-rose)' }}>{error}</div>}
        <button type="submit" disabled={busy || !email.trim()} className="btn btn-primary">
          {busy ? 'Отправляю…' : 'Отправить ссылку'}
        </button>
      </form>
    </div>
  );
}

function RecoveryConfirm({ token }: { token: string }) {
  const navigate = useNavigate();
  const { setAccessToken } = useAuth();
  const [status, setStatus] = useState<'loading' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/auth/recovery/confirm`, {
          method: 'POST', credentials: 'include',
          headers: { 'Content-Type': 'application/json', 'x-requested-with': 'webapp' },
          body: JSON.stringify({ token }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.message ?? 'Ссылка недействительна или истекла');
        }
        const { accessToken, expiresIn } = await res.json() as { accessToken: string; expiresIn: number };
        setAccessToken(accessToken, expiresIn);
        navigate('/account?recovered=1', { replace: true });
      } catch (e) {
        setStatus('error');
        setError(String(e).replace('Error: ', ''));
      }
    })();
  }, [token, setAccessToken, navigate]);

  if (status === 'loading') {
    return <div className="loader-center" style={{ minHeight: '60vh' }}><div className="spinner" /></div>;
  }
  return (
    <div className="page-inner-wide" style={{ paddingTop: 80, maxWidth: 480, margin: '0 auto' }}>
      <div className="eyebrow" style={{ marginBottom: 14 }}>Восстановление</div>
      <h1 style={{ fontSize: 28, fontWeight: 600, marginBottom: 14 }}>Не получилось</h1>
      <div className="text-sm" style={{ color: 'var(--c-rose)', marginBottom: 24 }}>{error}</div>
      <button onClick={() => navigate('/auth/recovery')} className="btn btn-primary">
        Запросить новую ссылку
      </button>
    </div>
  );
}
