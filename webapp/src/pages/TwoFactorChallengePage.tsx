import { useEffect, useRef, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? '';

// Page the user lands on after primary login (Google/Telegram/VK) IF their
// account has TOTP enabled. They paste a 6-digit code (or a recovery code)
// to exchange the challenge token for a real session.
export function TwoFactorChallengePage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { setAccessToken } = useAuth();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const challengeToken = params.get('token') ?? '';
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!challengeToken) { navigate('/login', { replace: true }); return; }
    inputRef.current?.focus();
  }, [challengeToken, navigate]);

  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (busy || !code.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/auth/2fa/challenge`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', 'x-requested-with': 'webapp' },
        body: JSON.stringify({ challengeToken, code: code.trim() }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({ message: 'Неверный код' }));
        throw new Error(body.message ?? 'Неверный код');
      }
      const { accessToken, expiresIn } = await res.json() as { accessToken: string; expiresIn: number };
      setAccessToken(accessToken, expiresIn);
      navigate('/today', { replace: true });
    } catch (err) {
      setError(String(err).replace('Error: ', ''));
      setBusy(false);
      setCode('');
      inputRef.current?.focus();
    }
  };

  return (
    <div className="page-inner-wide" style={{ paddingTop: 80, paddingBottom: 80, maxWidth: 420, margin: '0 auto' }}>
      <div className="eyebrow" style={{ marginBottom: 14 }}>Двухфакторная проверка</div>
      <h1 style={{ fontSize: 32, fontWeight: 600, letterSpacing: '-0.03em', lineHeight: 1.1, marginBottom: 14 }}>
        Введи код из приложения
      </h1>
      <div className="text-md muted" style={{ lineHeight: 1.6, marginBottom: 32 }}>
        Открой приложение-аутентификатор (Google Authenticator, 1Password, Bitwarden и т.п.) и введи 6-значный код.
        Можно ввести один из recovery-кодов, если потерял доступ к телефону.
      </div>

      <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <input
          ref={inputRef}
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          value={code}
          onChange={e => setCode(e.target.value)}
          placeholder="123456"
          disabled={busy}
          style={{
            padding: '14px 16px',
            border: '1px solid var(--line)',
            borderRadius: 12,
            background: 'var(--surface)',
            color: 'var(--text)',
            fontSize: 22,
            letterSpacing: '0.25em',
            textAlign: 'center',
            fontVariantNumeric: 'tabular-nums',
            fontFamily: 'monospace',
          }}
        />
        {error && (
          <div className="text-sm" style={{ color: 'var(--c-rose)', padding: '8px 0' }}>{error}</div>
        )}
        <button type="submit" disabled={busy || !code.trim()} className="btn btn-primary" style={{ marginTop: 8 }}>
          {busy ? 'Проверяю…' : 'Войти'}
        </button>
      </form>
    </div>
  );
}
