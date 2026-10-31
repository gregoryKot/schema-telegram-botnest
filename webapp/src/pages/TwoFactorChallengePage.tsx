import { useEffect, useRef, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/authContext';
import { OtpCells } from './login/OtpCells';
import { RecoveryCodeField } from './login/RecoveryCodeField';
import '../styles/auth-login.css';
import { TwoFactorIntro } from './login/TwoFactorIntro';
import { humanizeThrown, readHumanError } from '../../../shared/src/api/humanizeError';

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
  const [recovery, setRecovery] = useState(false);
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
      // 401 сервера — «Invalid 2FA code»; лимит и авария — свой текст, не «Неверный код».
      if (!res.ok) throw new Error((await readHumanError(res, 'Неверный код')).message);
      const { accessToken, expiresIn } = await res.json() as { accessToken: string; expiresIn: number };
      setAccessToken(accessToken, expiresIn);
      navigate('/today', { replace: true });
    } catch (err) {
      setError(humanizeThrown(err, 'Не получилось войти'));
      setBusy(false);
      setCode('');
      inputRef.current?.focus();
    }
  };

  const switchMode = () => { setRecovery(r => !r); setCode(''); setError(null); };
  useEffect(() => { inputRef.current?.focus(); }, [recovery]);

  return (
    <div className="light-lock al-2fa">
      <div className="al-2fa-in">
        <TwoFactorIntro />

        <form onSubmit={submit} className="al-form">
          {recovery ? (
            <RecoveryCodeField ref={inputRef} value={code} onChange={setCode} disabled={busy} />
          ) : (
            <OtpCells ref={inputRef} value={code} onChange={setCode} disabled={busy} label="Код из приложения" />
          )}
          {error && <p className="al-error">{error}</p>}
          <button type="submit" disabled={busy || !code.trim()} className="al-submit">
            {busy ? 'Проверяю…' : 'Подтвердить'}
          </button>
          <p className="al-foot" style={{ textAlign: 'center' }}>
            {recovery ? 'Есть телефон? ' : 'Нет телефона? '}
            <button type="button" className="al-linkbtn" onClick={switchMode}>
              {recovery ? 'Ввести код из приложения' : 'Ввести recovery-код'}
            </button>
          </p>
        </form>
      </div>
    </div>
  );
}
